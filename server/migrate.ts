import { db } from "./db";
import { sql } from "drizzle-orm";

async function tableExists(tableName: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = ${tableName}
    );
  `);
  return result.rows[0]?.exists || false;
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = ${tableName}
      AND column_name = ${columnName}
    );
  `);
  return result.rows[0]?.exists || false;
}

async function addColumn(tableName: string, columnName: string, definition: string) {
  await db.execute(sql.raw(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`));
  console.log(`✅ Added column ${columnName} to ${tableName}`);
}

export async function runMigrations() {
  try {
    console.log("🔄 Starting database migration...");

    // Create users table FIRST
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        email TEXT UNIQUE,
        is_admin BOOLEAN DEFAULT FALSE,
        department TEXT,
        role_id INTEGER,
        mfa_secret TEXT,
        mfa_enabled BOOLEAN DEFAULT FALSE,
        force_password_change BOOLEAN DEFAULT FALSE,
        permissions JSONB DEFAULT '{"assets": {"view": true, "edit": false, "add": false}, "components": {"view": true, "edit": false, "add": false}, "accessories": {"view": true, "edit": false, "add": false}, "consumables": {"view": true, "edit": false, "add": false}, "licenses": {"view": true, "edit": false, "add": false}, "users": {"view": false, "edit": false, "add": false}, "reports": {"view": true, "edit": false, "add": false}, "vmMonitoring": {"view": true, "edit": false, "add": false}, "networkDiscovery": {"view": true, "edit": false, "add": false}, "bitlockerKeys": {"view": false, "edit": false, "add": false}, "admin": {"view": false, "edit": false, "add": false}}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Users table verified");

    // Create IAM Accounts table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS iam_accounts (
        id SERIAL PRIMARY KEY,
        requestor TEXT NOT NULL,
        knox_id TEXT NOT NULL,
        name TEXT,
        user_knox_id TEXT,
        permission_type TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        project TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        approval_number TEXT NOT NULL,
        remarks TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE(knox_id, resource_type, project)
      )
    `);
    console.log("✅ IAM Accounts table verified");

    // All tables verification loop
    const allTables = [
      'assets', 'components', 'accessories', 'consumables', 'licenses',
      'license_assignments', 'consumable_assignments', 'activities', 'vm_inventory',
      'vms', 'monitor_inventory', 'bitlocker_keys', 'it_equipment', 'it_equipment_assignments',
      'system_settings', 'zabbix_settings', 'discovered_hosts', 'vm_monitoring',
      'vm_approval_history', 'azure_inventory', 'gcp_inventory', 'aws_inventory', 
      'custom_pages'
    ];

    for (const tableName of allTables) {
      if (!(await tableExists(tableName))) {
        // ... (existing table creation logic)
      } else {
        // Add missing columns to existing tables
        if (tableName === 'users') {
          if (!(await columnExists('users', 'first_name'))) await addColumn('users', 'first_name', 'TEXT');
          if (!(await columnExists('users', 'last_name'))) await addColumn('users', 'last_name', 'TEXT');
          if (!(await columnExists('users', 'mfa_enabled'))) await addColumn('users', 'mfa_enabled', 'BOOLEAN DEFAULT FALSE');
          if (!(await columnExists('users', 'mfa_secret'))) await addColumn('users', 'mfa_secret', 'TEXT');
          if (!(await columnExists('users', 'force_password_change'))) await addColumn('users', 'force_password_change', 'BOOLEAN DEFAULT FALSE');
          if (!(await columnExists('users', 'permissions'))) await addColumn('users', 'permissions', 'JSONB');
        } else if (tableName === 'assets') {
          if (!(await columnExists('assets', 'condition'))) await addColumn('assets', 'condition', "TEXT NOT NULL DEFAULT 'Good'");
          if (!(await columnExists('assets', 'knox_id'))) await addColumn('assets', 'knox_id', 'TEXT');
          if (!(await columnExists('assets', 'ip_address'))) await addColumn('assets', 'ip_address', 'TEXT');
          if (!(await columnExists('assets', 'mac_address'))) await addColumn('assets', 'mac_address', 'TEXT');
          if (!(await columnExists('assets', 'os_type'))) await addColumn('assets', 'os_type', 'TEXT');
          if (!(await columnExists('assets', 'finance_updated'))) await addColumn('assets', 'finance_updated', 'BOOLEAN DEFAULT FALSE');
          if (!(await columnExists('assets', 'department'))) await addColumn('assets', 'department', 'TEXT');
        } else if (tableName === 'components') {
          if (!(await columnExists('components', 'category'))) await addColumn('components', 'category', 'TEXT NOT NULL DEFAULT \'General\'');
          if (!(await columnExists('components', 'quantity'))) await addColumn('components', 'quantity', 'INTEGER NOT NULL DEFAULT 0');
        } else if (tableName === 'vm_inventory') {
          if (!(await columnExists('vm_inventory', 'vm_status'))) await addColumn('vm_inventory', 'vm_status', "TEXT NOT NULL DEFAULT 'Active'");
          if (!(await columnExists('vm_inventory', 'cpu_count'))) await addColumn('vm_inventory', 'cpu_count', 'INTEGER DEFAULT 0');
          if (!(await columnExists('vm_inventory', 'memory_gb'))) await addColumn('vm_inventory', 'memory_gb', 'INTEGER DEFAULT 0');
          if (!(await columnExists('vm_inventory', 'disk_capacity_gb'))) await addColumn('vm_inventory', 'disk_capacity_gb', 'INTEGER DEFAULT 0');
        }
      }

      if (await tableExists(tableName)) {
        console.log(`   ✅ ${tableName} verified`);
      }
    }

    console.log("🎉 Database migration and verification completed successfully!");
  } catch (error: any) {
    console.error("❌ Migration failed:", error.message);
    throw error;
  }
}
