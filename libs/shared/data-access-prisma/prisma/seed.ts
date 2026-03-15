import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../src';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface ResourceTypeDef {
  slug: string;
  label: string;
  isEssential: boolean;
}

interface RelationshipDef {
  sourceSlug: string;
  targetSlug: string;
  relationLabel: string;
}

interface IndustryTypeTemplate {
  slug: string;
  label: string;
  resourceTypes: ResourceTypeDef[];
  relationships: RelationshipDef[];
}

async function seedTemplate(template: IndustryTypeTemplate) {
  const existing = await prisma.industryType.findUnique({
    where: { slug: template.slug },
  });
  if (existing) {
    console.log(`  ↳ "${template.slug}" already exists, skipping.`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    const industryType = await tx.industryType.create({
      data: { slug: template.slug, label: template.label },
    });

    const createdTypes = await Promise.all(
      template.resourceTypes.map((rt) =>
        tx.resourceTypeDefinition.create({
          data: {
            industryTypeId: industryType.id,
            slug: rt.slug,
            label: rt.label,
            isEssential: rt.isEssential,
          },
        }),
      ),
    );

    const slugToId = new Map(createdTypes.map((t) => [t.slug, t.id]));
    const id = (slug: string) => {
      const resolved = slugToId.get(slug);
      if (!resolved) throw new Error(`Unknown slug "${slug}" in relationships`);
      return resolved;
    };

    await Promise.all(
      template.relationships.map((rel) =>
        tx.resourceTypeRelationship.create({
          data: {
            industryTypeId: industryType.id,
            sourceResourceTypeId: id(rel.sourceSlug),
            targetResourceTypeId: id(rel.targetSlug),
            relationLabel: rel.relationLabel,
          },
        }),
      ),
    );

    console.log(`  ↳ "${template.slug}" created.`);
  });
}

async function deleteTemplate(slug: string) {
  const industryType = await prisma.industryType.findUnique({
    where: { slug },
  });
  if (!industryType) {
    console.log(`  ↳ "${slug}" not found, skipping.`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.resourceTypeRelationship.deleteMany({
      where: { industryTypeId: industryType.id },
    });
    await tx.resourceTypeDefinition.deleteMany({
      where: { industryTypeId: industryType.id },
    });
    await tx.industryType.delete({ where: { id: industryType.id } });
    console.log(`  ↳ "${slug}" deleted.`);
  });
}

const schoolTemplate: IndustryTypeTemplate = {
  slug: 'school',
  label: 'School',
  resourceTypes: [
    { slug: 'school', label: 'School', isEssential: true },
    { slug: 'department', label: 'Department', isEssential: true },
    { slug: 'classroom', label: 'Classroom', isEssential: true },
    { slug: 'course', label: 'Course', isEssential: false },
    { slug: 'student', label: 'Student', isEssential: false },
    { slug: 'teacher', label: 'Teacher', isEssential: false },
  ],
  relationships: [
    {
      sourceSlug: 'school',
      targetSlug: 'department',
      relationLabel: 'has_department',
    },
    {
      sourceSlug: 'department',
      targetSlug: 'classroom',
      relationLabel: 'has_classroom',
    },
    {
      sourceSlug: 'department',
      targetSlug: 'course',
      relationLabel: 'offers_course',
    },
    {
      sourceSlug: 'classroom',
      targetSlug: 'student',
      relationLabel: 'enrolls_student',
    },
    {
      sourceSlug: 'classroom',
      targetSlug: 'teacher',
      relationLabel: 'assigned_teacher',
    },
    {
      sourceSlug: 'classroom',
      targetSlug: 'course',
      relationLabel: 'runs_course',
    },
  ],
};

const hospitalTemplate: IndustryTypeTemplate = {
  slug: 'hospital',
  label: 'Hospital',
  resourceTypes: [
    { slug: 'hospital', label: 'Hospital', isEssential: true },
    { slug: 'department', label: 'Department', isEssential: true },
    { slug: 'ward', label: 'Ward', isEssential: true },
    { slug: 'doctor', label: 'Doctor', isEssential: false },
    { slug: 'nurse', label: 'Nurse', isEssential: false },
    { slug: 'patient', label: 'Patient', isEssential: false },
  ],
  relationships: [
    {
      sourceSlug: 'hospital',
      targetSlug: 'department',
      relationLabel: 'has_department',
    },
    { sourceSlug: 'department', targetSlug: 'ward', relationLabel: 'has_ward' },
    {
      sourceSlug: 'ward',
      targetSlug: 'doctor',
      relationLabel: 'assigned_doctor',
    },
    {
      sourceSlug: 'ward',
      targetSlug: 'nurse',
      relationLabel: 'assigned_nurse',
    },
    {
      sourceSlug: 'ward',
      targetSlug: 'patient',
      relationLabel: 'admits_patient',
    },
    {
      sourceSlug: 'doctor',
      targetSlug: 'patient',
      relationLabel: 'treats_patient',
    },
  ],
};

const corporateTemplate: IndustryTypeTemplate = {
  slug: 'corporate',
  label: 'Corporate',
  resourceTypes: [
    { slug: 'company', label: 'Company', isEssential: true },
    { slug: 'department', label: 'Department', isEssential: true },
    { slug: 'team', label: 'Team', isEssential: true },
    { slug: 'employee', label: 'Employee', isEssential: false },
    { slug: 'project', label: 'Project', isEssential: false },
  ],
  relationships: [
    {
      sourceSlug: 'company',
      targetSlug: 'department',
      relationLabel: 'has_department',
    },
    { sourceSlug: 'department', targetSlug: 'team', relationLabel: 'has_team' },
    { sourceSlug: 'team', targetSlug: 'employee', relationLabel: 'has_member' },
    {
      sourceSlug: 'team',
      targetSlug: 'project',
      relationLabel: 'owns_project',
    },
    {
      sourceSlug: 'employee',
      targetSlug: 'project',
      relationLabel: 'assigned_to',
    },
  ],
};

async function main() {
  const command = process.argv[2];
  const targetSlug = process.argv[3];

  if (command === 'delete') {
    if (!targetSlug) {
      console.error('Usage: ts-node seed.ts delete <slug>');
      process.exit(1);
    }
    console.log(`Deleting "${targetSlug}"...`);
    await deleteTemplate(targetSlug);
    return;
  }

  console.log('Seeding platform industry types...');
  await seedTemplate(schoolTemplate);
  await seedTemplate(hospitalTemplate);
  await seedTemplate(corporateTemplate);
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
