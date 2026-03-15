-- CreateTable
CREATE TABLE "organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "industry_type_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "industry_type" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "industry_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_type_definition" (
    "id" UUID NOT NULL,
    "industry_type_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "is_essential" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_type_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_type_relationship" (
    "id" UUID NOT NULL,
    "industry_type_id" UUID NOT NULL,
    "source_resource_type_id" UUID NOT NULL,
    "target_resource_type_id" UUID NOT NULL,
    "relation_label" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_type_relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "resource_type_definition_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_relationship" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "relationship_def_id" UUID NOT NULL,
    "source_resource_id" UUID NOT NULL,
    "target_resource_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member" (
    "id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "industry_type_slug_key" ON "industry_type"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "resource_type_definition_industry_type_id_slug_key" ON "resource_type_definition"("industry_type_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "resource_type_relationship_industry_type_id_source_resource_key" ON "resource_type_relationship"("industry_type_id", "source_resource_type_id", "target_resource_type_id", "relation_label");

-- CreateIndex
CREATE UNIQUE INDEX "resource_relationship_org_id_relationship_def_id_source_res_key" ON "resource_relationship"("org_id", "relationship_def_id", "source_resource_id", "target_resource_id");

-- AddForeignKey
ALTER TABLE "organization" ADD CONSTRAINT "organization_industry_type_id_fkey" FOREIGN KEY ("industry_type_id") REFERENCES "industry_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_type_definition" ADD CONSTRAINT "resource_type_definition_industry_type_id_fkey" FOREIGN KEY ("industry_type_id") REFERENCES "industry_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_type_relationship" ADD CONSTRAINT "resource_type_relationship_industry_type_id_fkey" FOREIGN KEY ("industry_type_id") REFERENCES "industry_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_type_relationship" ADD CONSTRAINT "resource_type_relationship_source_resource_type_id_fkey" FOREIGN KEY ("source_resource_type_id") REFERENCES "resource_type_definition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_type_relationship" ADD CONSTRAINT "resource_type_relationship_target_resource_type_id_fkey" FOREIGN KEY ("target_resource_type_id") REFERENCES "resource_type_definition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource" ADD CONSTRAINT "resource_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource" ADD CONSTRAINT "resource_resource_type_definition_id_fkey" FOREIGN KEY ("resource_type_definition_id") REFERENCES "resource_type_definition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_relationship" ADD CONSTRAINT "resource_relationship_relationship_def_id_fkey" FOREIGN KEY ("relationship_def_id") REFERENCES "resource_type_relationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_relationship" ADD CONSTRAINT "resource_relationship_source_resource_id_fkey" FOREIGN KEY ("source_resource_id") REFERENCES "resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_relationship" ADD CONSTRAINT "resource_relationship_target_resource_id_fkey" FOREIGN KEY ("target_resource_id") REFERENCES "resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
