import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function run() {
  // Create enums
  await db.execute(sql`DO $$ BEGIN CREATE TYPE hub_visibility_level AS ENUM ('public', 'resident', 'owner', 'board', 'admin'); EXCEPTION WHEN duplicate_object THEN null; END $$`);
  await db.execute(sql`DO $$ BEGIN CREATE TYPE hub_info_block_category AS ENUM ('trash', 'parking', 'emergency', 'maintenance', 'rules', 'amenities', 'custom'); EXCEPTION WHEN duplicate_object THEN null; END $$`);
  await db.execute(sql`DO $$ BEGIN CREATE TYPE hub_action_route_type AS ENUM ('internal', 'external'); EXCEPTION WHEN duplicate_object THEN null; END $$`);
  await db.execute(sql`DO $$ BEGIN CREATE TYPE hub_map_node_type AS ENUM ('building', 'unit', 'common-area', 'parking', 'amenity', 'path', 'infrastructure'); EXCEPTION WHEN duplicate_object THEN null; END $$`);
  await db.execute(sql`DO $$ BEGIN CREATE TYPE hub_map_issue_category AS ENUM ('maintenance', 'repair', 'safety', 'landscaping', 'suggestion', 'inspection', 'other'); EXCEPTION WHEN duplicate_object THEN null; END $$`);
  await db.execute(sql`DO $$ BEGIN CREATE TYPE hub_map_issue_status AS ENUM ('reported', 'under-review', 'approved', 'in-progress', 'resolved', 'dismissed'); EXCEPTION WHEN duplicate_object THEN null; END $$`);
  await db.execute(sql`DO $$ BEGIN CREATE TYPE hub_notice_category AS ENUM ('general', 'maintenance', 'governance', 'safety', 'seasonal', 'meeting', 'financial'); EXCEPTION WHEN duplicate_object THEN null; END $$`);
  console.log("Enums created");

  // Hub page configs
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hub_page_configs (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      association_id VARCHAR NOT NULL REFERENCES associations(id),
      is_enabled INTEGER NOT NULL DEFAULT 0,
      logo_url TEXT,
      banner_image_url TEXT,
      community_description TEXT,
      section_order JSONB NOT NULL DEFAULT '["notices","quick-actions","info-blocks","map","contacts"]',
      enabled_sections JSONB NOT NULL DEFAULT '["notices","quick-actions","info-blocks","contacts"]',
      theme_color TEXT,
      slug TEXT,
      welcome_mode_enabled INTEGER NOT NULL DEFAULT 0,
      welcome_headline TEXT,
      welcome_highlights JSONB,
      created_at TIMESTAMP DEFAULT now() NOT NULL,
      updated_at TIMESTAMP DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS hub_page_configs_association_uq ON hub_page_configs (association_id)`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS hub_page_configs_slug_uq ON hub_page_configs (slug)`);
  console.log("hub_page_configs created");

  // Hub action links
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hub_action_links (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      association_id VARCHAR NOT NULL REFERENCES associations(id),
      label TEXT NOT NULL,
      icon_key TEXT,
      route_type hub_action_route_type NOT NULL DEFAULT 'internal',
      route_target TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      auto_derived INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT now() NOT NULL,
      updated_at TIMESTAMP DEFAULT now() NOT NULL
    )
  `);
  console.log("hub_action_links created");

  // Hub info blocks
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hub_info_blocks (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      association_id VARCHAR NOT NULL REFERENCES associations(id),
      category hub_info_block_category NOT NULL DEFAULT 'custom',
      title TEXT NOT NULL,
      body TEXT,
      external_links JSONB NOT NULL DEFAULT '[]'::jsonb,
      order_index INTEGER NOT NULL DEFAULT 0,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT now() NOT NULL,
      updated_at TIMESTAMP DEFAULT now() NOT NULL
    )
  `);
  console.log("hub_info_blocks created");

  // Hub map layers
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hub_map_layers (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      association_id VARCHAR NOT NULL REFERENCES associations(id),
      name TEXT NOT NULL,
      base_image_url TEXT NOT NULL,
      coordinate_system JSONB,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT now() NOT NULL,
      updated_at TIMESTAMP DEFAULT now() NOT NULL
    )
  `);
  console.log("hub_map_layers created");

  // Hub map nodes
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hub_map_nodes (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      layer_id VARCHAR NOT NULL REFERENCES hub_map_layers(id),
      association_id VARCHAR NOT NULL REFERENCES associations(id),
      node_type hub_map_node_type NOT NULL,
      label TEXT NOT NULL,
      linked_building_id VARCHAR REFERENCES buildings(id),
      linked_unit_id VARCHAR REFERENCES units(id),
      geometry JSONB NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT now() NOT NULL,
      updated_at TIMESTAMP DEFAULT now() NOT NULL
    )
  `);
  console.log("hub_map_nodes created");

  // Hub map issues
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hub_map_issues (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      association_id VARCHAR NOT NULL REFERENCES associations(id),
      map_node_id VARCHAR REFERENCES hub_map_nodes(id),
      layer_id VARCHAR NOT NULL REFERENCES hub_map_layers(id),
      reported_by_portal_access_id VARCHAR REFERENCES portal_access(id),
      title TEXT NOT NULL,
      description TEXT,
      category hub_map_issue_category NOT NULL DEFAULT 'maintenance',
      images JSONB NOT NULL DEFAULT '[]'::jsonb,
      coordinates JSONB,
      status hub_map_issue_status NOT NULL DEFAULT 'reported',
      visibility_level hub_visibility_level NOT NULL DEFAULT 'board',
      priority roadmap_priority NOT NULL DEFAULT 'medium',
      linked_ticket_id VARCHAR,
      reviewed_by TEXT,
      reviewed_at TIMESTAMP,
      resolved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT now() NOT NULL,
      updated_at TIMESTAMP DEFAULT now() NOT NULL
    )
  `);
  console.log("hub_map_issues created");

  // Extend community_announcements
  await db.execute(sql`ALTER TABLE community_announcements ADD COLUMN IF NOT EXISTS notice_category TEXT`);
  await db.execute(sql`ALTER TABLE community_announcements ADD COLUMN IF NOT EXISTS visibility_level TEXT`);
  await db.execute(sql`ALTER TABLE community_announcements ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb`);
  await db.execute(sql`ALTER TABLE community_announcements ADD COLUMN IF NOT EXISTS is_draft INTEGER NOT NULL DEFAULT 0`);
  await db.execute(sql`ALTER TABLE community_announcements ADD COLUMN IF NOT EXISTS scheduled_publish_at TIMESTAMP`);
  console.log("community_announcements extended");

  console.log("\nAll Community Hub schema created successfully!");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
