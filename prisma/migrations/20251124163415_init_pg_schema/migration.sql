-- CreateEnum
CREATE TYPE "SettingCategory" AS ENUM ('general', 'ui', 'content', 'media', 'contact', 'seo', 'social', 'footer');

-- CreateEnum
CREATE TYPE "SettingDataType" AS ENUM ('string', 'number', 'boolean', 'url', 'email', 'json', 'text');

-- CreateEnum
CREATE TYPE "PersonnelRole" AS ENUM ('记录人', '采摘队长', '制茶师');

-- CreateEnum
CREATE TYPE "FarmActivityType" AS ENUM ('无', '施肥', '修剪', '灌溉', '采摘', '异常');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('进行中', '已完成', '已发布');

-- CreateEnum
CREATE TYPE "AdoptionPlanType" AS ENUM ('private', 'enterprise', 'b2b');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "reset_password_token" VARCHAR(128),
    "reset_password_expires" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plots" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "carousel_images" JSONB NOT NULL DEFAULT '[]',
    "info_list" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT,
    "description" VARCHAR(200),
    "category" "SettingCategory" NOT NULL DEFAULT 'general',
    "data_type" "SettingDataType" NOT NULL DEFAULT 'string',
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weather_templates" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "svg_icon" TEXT NOT NULL,
    "temperature_range" VARCHAR(50),
    "description" VARCHAR(200),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weather_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tea_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "image_url" TEXT,
    "description" TEXT,
    "yield_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "picking_period" VARCHAR(100),
    "picking_start_date" DATE,
    "picking_end_date" DATE,
    "sort_order" INTEGER NOT NULL DEFAULT 999,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tea_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personnel" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "avatar_url" TEXT,
    "role" "PersonnelRole" NOT NULL,
    "experience_years" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grades" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "badge_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_growth_logs" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "plot_id" UUID,
    "recorder_name" VARCHAR(100),
    "recorder_id" UUID,
    "main_image_url" TEXT,
    "status_tag" JSONB,
    "weather" JSONB,
    "summary" TEXT,
    "detail_gallery" JSONB,
    "photo_info" JSONB,
    "environment_data" JSONB,
    "full_log" TEXT,
    "farm_activity_type" "FarmActivityType" NOT NULL DEFAULT '无',
    "farm_activity_log" TEXT,
    "phenological_observation" TEXT,
    "abnormal_event" JSONB,
    "harvest_weight_kg" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_growth_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_summaries" (
    "id" UUID NOT NULL,
    "year_month" CHAR(7) NOT NULL,
    "plot_id" UUID,
    "detail_gallery" JSONB,
    "harvest_stats" JSONB,
    "farm_calendar" TEXT,
    "abnormal_summary" JSONB,
    "climate_summary" JSONB,
    "next_month_plan" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "harvest_records" (
    "id" UUID NOT NULL,
    "harvest_date" DATE NOT NULL,
    "fresh_leaf_weight_kg" DECIMAL(10,2) NOT NULL,
    "weather" JSONB,
    "images_and_videos" JSONB,
    "media_urls" JSONB,
    "harvest_team" JSONB,
    "harvest_team_id" UUID,
    "assigned_batch_id" UUID,
    "category_id" UUID,
    "category_name" VARCHAR(50),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "harvest_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" UUID NOT NULL,
    "batch_number" VARCHAR(50) NOT NULL,
    "category_name" VARCHAR(50) NOT NULL,
    "tea_master" JSONB,
    "tea_master_id" UUID,
    "production_steps" JSONB,
    "tasting_report" JSONB,
    "product_appreciation" JSONB,
    "final_product_weight_kg" DECIMAL(10,2),
    "grade" VARCHAR(50),
    "grade_id" UUID,
    "production_date" DATE DEFAULT CURRENT_TIMESTAMP,
    "status" "BatchStatus" NOT NULL,
    "cover_image_url" TEXT,
    "detail_cover_image_url" TEXT,
    "images_and_videos" JSONB,
    "notes" TEXT,
    "detail_title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_harvest_records" (
    "batch_id" UUID NOT NULL,
    "harvest_record_id" UUID NOT NULL,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "batch_harvest_records_pkey" PRIMARY KEY ("batch_id","harvest_record_id")
);

-- CreateTable
CREATE TABLE "production_step_templates" (
    "id" UUID NOT NULL,
    "step_name" VARCHAR(20) NOT NULL,
    "manual_craft" JSONB,
    "modern_craft" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_step_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "title_templates" (
    "id" UUID NOT NULL,
    "category_name" VARCHAR(50) NOT NULL,
    "title_template" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "title_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appreciation_templates" (
    "id" UUID NOT NULL,
    "category_name" VARCHAR(50) NOT NULL,
    "tasting_notes" TEXT,
    "brewing_suggestion" TEXT,
    "storage_method" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appreciation_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adoption_plans" (
    "id" UUID NOT NULL,
    "type" "AdoptionPlanType" NOT NULL,
    "marketing_header" JSONB,
    "value_propositions" JSONB,
    "customer_cases" JSONB,
    "scenario_applications" JSONB,
    "packages" JSONB,
    "comparison_package_names" JSONB,
    "comparison_features" JSONB,
    "process_steps" JSONB,
    "use_scenarios" JSONB,
    "service_contents" JSONB,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adoption_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "plots_name_key" ON "plots"("name");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "weather_templates_name_key" ON "weather_templates"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tea_categories_name_key" ON "tea_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tea_categories_slug_key" ON "tea_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "grades_name_key" ON "grades"("name");

-- CreateIndex
CREATE UNIQUE INDEX "daily_growth_logs_date_key" ON "daily_growth_logs"("date");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_summaries_year_month_key" ON "monthly_summaries"("year_month");

-- CreateIndex
CREATE UNIQUE INDEX "batches_batch_number_key" ON "batches"("batch_number");

-- CreateIndex
CREATE UNIQUE INDEX "production_step_templates_step_name_key" ON "production_step_templates"("step_name");

-- CreateIndex
CREATE UNIQUE INDEX "title_templates_category_name_key" ON "title_templates"("category_name");

-- CreateIndex
CREATE UNIQUE INDEX "appreciation_templates_category_name_key" ON "appreciation_templates"("category_name");

-- CreateIndex
CREATE UNIQUE INDEX "adoption_plans_type_key" ON "adoption_plans"("type");

-- AddForeignKey
ALTER TABLE "daily_growth_logs" ADD CONSTRAINT "daily_growth_logs_plot_id_fkey" FOREIGN KEY ("plot_id") REFERENCES "plots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_growth_logs" ADD CONSTRAINT "daily_growth_logs_recorder_id_fkey" FOREIGN KEY ("recorder_id") REFERENCES "personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_summaries" ADD CONSTRAINT "monthly_summaries_plot_id_fkey" FOREIGN KEY ("plot_id") REFERENCES "plots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harvest_records" ADD CONSTRAINT "harvest_records_harvest_team_id_fkey" FOREIGN KEY ("harvest_team_id") REFERENCES "personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harvest_records" ADD CONSTRAINT "harvest_records_assigned_batch_id_fkey" FOREIGN KEY ("assigned_batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harvest_records" ADD CONSTRAINT "harvest_records_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "tea_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_tea_master_id_fkey" FOREIGN KEY ("tea_master_id") REFERENCES "personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_harvest_records" ADD CONSTRAINT "batch_harvest_records_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_harvest_records" ADD CONSTRAINT "batch_harvest_records_harvest_record_id_fkey" FOREIGN KEY ("harvest_record_id") REFERENCES "harvest_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "title_templates" ADD CONSTRAINT "title_templates_category_name_fkey" FOREIGN KEY ("category_name") REFERENCES "tea_categories"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appreciation_templates" ADD CONSTRAINT "appreciation_templates_category_name_fkey" FOREIGN KEY ("category_name") REFERENCES "tea_categories"("name") ON DELETE RESTRICT ON UPDATE CASCADE;
