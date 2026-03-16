// scripts/verify-fga.mjs
// Usage: node scripts/verify-fga.mjs

const ORG_API = 'http://localhost:3002/api';
const RESOURCE_API = 'http://localhost:3001/api';
const FGA_API = 'http://localhost:8081';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pass = (s) => console.log(`\x1b[32m✓ ${s}\x1b[0m`);
const fail = (s) => console.log(`\x1b[31m✗ ${s}\x1b[0m`);
const info = (s) => console.log(`\x1b[34m→ ${s}\x1b[0m`);
const section = (s) => console.log(`\x1b[33m\n=== ${s} ===\x1b[0m`);

const post = (url, body) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json());

const get = (url) => fetch(url).then((r) => r.json());
const del = (url) => fetch(url, { method: 'DELETE' }).then((r) => r.json());

const fgaCheck = async (storeId, user, relation, object) => {
  const res = await post(`${FGA_API}/stores/${storeId}/check`, {
    tuple_key: { user, relation, object },
  });
  return res.allowed ?? false;
};

const assertAllowed = (label, allowed) =>
  allowed ? pass(label) : fail(`${label} — expected allowed=true`);

const assertDenied = (label, allowed) =>
  !allowed ? pass(label) : fail(`${label} — expected allowed=false`);

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Onboard
  section('1. Onboarding');
  const onboard = await post(`${ORG_API}/onboarding`, {
    name: 'Springfield Elementary 2', // ← orgName not name
    industryTypeSlug: 'school',
  });

  if (!onboard.org?.id) {
    fail('Onboarding failed');
    console.log(onboard);
    process.exit(1);
  }

  const orgId = onboard.org.id;
  const resourceMap = onboard.seed.resourceMap;
  const schoolId = resourceMap.school;
  const deptId = resourceMap.department;
  const classId = resourceMap.classroom;

  pass(`Org created: ${orgId}`);
  info(`School:     ${schoolId}`);
  info(`Department: ${deptId}`);
  info(`Classroom:  ${classId}`);

  // 2. Verify FGA store + model on org
  section('2. FGA Store + Model');
  const org = await get(`${ORG_API}/organization/${orgId}`);
  const fgaStoreId = org.fgaStoreId;
  const fgaModelId = org.fgaModelId;

  console.log(org);
  if (!fgaStoreId) {
    fail('fgaStoreId not set on org — check FGA provisioning logs');
    process.exit(1);
  }
  pass(`FGA store: ${fgaStoreId}`);
  fgaModelId
    ? pass(`FGA model: ${fgaModelId}`)
    : fail('fgaModelId not set on org');

  // 3. Verify authorization model
  section('3. Authorization Model');
  const models = await get(
    `${FGA_API}/stores/${fgaStoreId}/authorization-models`,
  );
  const typeDefs = models.authorization_models?.[0]?.type_definitions ?? [];
  typeDefs.length > 0
    ? pass(
        `Model has ${typeDefs.length} types: ${typeDefs.map((t) => t.type).join(', ')}`,
      )
    : fail('No type definitions found');

  // 4. — verify seeded tuples via check instead of read
  section('4. Seeded Structural Tuples');
  const schoolHasDept = await fgaCheck(
    fgaStoreId,
    `school:${schoolId}`,
    'parent',
    `department:${deptId}`,
  );
  schoolHasDept
    ? pass(`Tuple exists: school → department`)
    : fail(`Tuple missing: school → department`);

  const deptHasClass = await fgaCheck(
    fgaStoreId,
    `department:${deptId}`,
    'parent',
    `classroom:${classId}`,
  );
  deptHasClass
    ? pass(`Tuple exists: department → classroom`)
    : fail(`Tuple missing: department → classroom`);
  // 5. Create a new department
  section('5. Create Resource');
  const newDept = await post(
    `${RESOURCE_API}/organizations/${orgId}/resources`,
    {
      name: 'Science Department',
      resourceTypeSlug: 'department',
    },
  );
  if (!newDept.id) {
    fail('Failed to create department');
    console.log(newDept);
    process.exit(1);
  }
  const newDeptId = newDept.id;
  pass(`New department: ${newDeptId}`);

  // 6. Link department to school
  section('6. Create Relationship (FGA tuple write)');
  const link = await post(
    `${RESOURCE_API}/organizations/${orgId}/resources/${schoolId}/relationships`,
    { targetResourceId: newDeptId, relationLabel: 'has_department' },
  );
  link.id
    ? pass(`Relationship created: ${link.id}`)
    : fail(`Failed to create relationship — ${JSON.stringify(link)}`);

  // 7. — verify new tuple via check
  section('7. Verify New Tuple in FGA');
  const newTupleExists = await fgaCheck(
    fgaStoreId,
    `school:${schoolId}`,
    'parent',
    `department:${newDeptId}`,
  );
  newTupleExists
    ? pass(`Tuple exists: school → new department`)
    : fail(`Tuple missing: school → new department`);

  // 8. Assign alice as admin
  section('8. Assign User Role');
  const assignRes = await post(`${FGA_API}/stores/${fgaStoreId}/write`, {
    writes: {
      tuple_keys: [
        { user: 'user:alice', relation: 'admin', object: `school:${schoolId}` },
      ],
    },
  });
  assignRes.code
    ? fail(`Failed to assign alice: ${assignRes.message}`)
    : pass('alice assigned as admin of school');

  section('9. Permission Checks');

  // Assign alice as admin of school
  await post(`${FGA_API}/stores/${fgaStoreId}/write`, {
    writes: {
      tuple_keys: [
        { user: 'user:alice', relation: 'admin', object: `school:${schoolId}` },
      ],
    },
  });

  // Assign bob as member of a specific classroom only
  await post(`${FGA_API}/stores/${fgaStoreId}/write`, {
    writes: {
      tuple_keys: [
        {
          user: 'user:bob',
          relation: 'member',
          object: `classroom:${classId}`,
        },
      ],
    },
  });

  // alice (admin) can access everything
  assertAllowed(
    'alice is admin of school',
    await fgaCheck(fgaStoreId, 'user:alice', 'admin', `school:${schoolId}`),
  );
  assertAllowed(
    'alice is member of department (inherited from school)',
    await fgaCheck(fgaStoreId, 'user:alice', 'member', `department:${deptId}`),
  );
  assertAllowed(
    'alice is member of classroom (inherited from department)',
    await fgaCheck(fgaStoreId, 'user:alice', 'member', `classroom:${classId}`),
  );

  // bob (classroom member only) can access classroom but NOT department or school
  assertAllowed(
    'bob is member of classroom (direct)',
    await fgaCheck(fgaStoreId, 'user:bob', 'member', `classroom:${classId}`),
  );
  assertDenied(
    'bob has no access to department (not inherited upward)',
    await fgaCheck(fgaStoreId, 'user:bob', 'member', `department:${deptId}`),
  );
  assertDenied(
    'bob has no access to school (not inherited upward)',
    await fgaCheck(fgaStoreId, 'user:bob', 'member', `school:${schoolId}`),
  );

  // charlie has no assignments
  assertDenied(
    'charlie has no access anywhere',
    await fgaCheck(
      fgaStoreId,
      'user:charlie',
      'member',
      `classroom:${classId}`,
    ),
  );

  // 10. Delete department
  section('10. Delete Resource (FGA tuple delete)');
  const deleted = await del(
    `${RESOURCE_API}/organizations/${orgId}/resources/${newDeptId}`,
  );
  deleted.deleted
    ? pass(`Department deleted: ${newDeptId}`)
    : fail(`Failed to delete — ${JSON.stringify(deleted)}`);

  // 11. Verify tuple removed
  section('11. Verify Tuple Removed from FGA');
  const tuplesAfterDelete = await get(`${FGA_API}/stores/${fgaStoreId}/tuples`);
  const deletedTuple = (tuplesAfterDelete.tuples ?? []).find(
    (t) => t.key.object === `department:${newDeptId}`,
  );
  deletedTuple
    ? fail('Tuple still exists in FGA after delete')
    : pass('Tuple removed from FGA');

  // 12. Confirm alice no longer has access
  section('12. Confirm Access Revoked');
  assertDenied(
    'alice no longer has member on deleted department',
    await fgaCheck(
      fgaStoreId,
      'user:alice',
      'member',
      `department:${newDeptId}`,
    ),
  );

  console.log('\n\x1b[32mVerification complete.\x1b[0m\n');
}

main().catch((err) => {
  console.error('\x1b[31mScript failed:\x1b[0m', err.message);
  process.exit(1);
});
