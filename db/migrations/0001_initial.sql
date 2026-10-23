PRAGMA foreign_keys = ON;
CREATE TABLE users (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, object_id TEXT NOT NULL, email TEXT, role TEXT NOT NULL CHECK(role IN ('sender','admin')), created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(tenant_id, object_id));
CREATE TABLE sending_identities (id TEXT PRIMARY KEY, email TEXT NOT NULL, display_name TEXT NOT NULL, provider_ref TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
-- Phase 1 configured identity is frozen on each batch; never accept client sender addresses.
CREATE TABLE batches (
 id TEXT PRIMARY KEY, creator_id TEXT NOT NULL, idempotency_key TEXT NOT NULL,
 payload_hash TEXT NOT NULL, subject TEXT NOT NULL, html TEXT NOT NULL, text TEXT NOT NULL,
 sender_id TEXT NOT NULL, sender_email TEXT NOT NULL, sender_name TEXT NOT NULL, reply_to TEXT NOT NULL,
 recipient_count INTEGER NOT NULL CHECK(recipient_count = 1), mock INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(creator_id, idempotency_key)
);
CREATE TABLE recipients (
 id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
 email TEXT NOT NULL, personalization TEXT NOT NULL DEFAULT '{}',
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','attempting','deferred','provider_accepted','unknown','rejected')),
 attempts INTEGER NOT NULL DEFAULT 0, provider_id TEXT, last_error TEXT,
 next_attempt_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(batch_id, email)
);
CREATE INDEX recipients_work ON recipients(state, next_attempt_at);
CREATE TABLE delivery_events (
 id TEXT PRIMARY KEY, recipient_id TEXT NOT NULL REFERENCES recipients(id) ON DELETE CASCADE,
 provider_event_id TEXT UNIQUE, event_type TEXT NOT NULL, event_at TEXT NOT NULL,
 ingested_at TEXT NOT NULL DEFAULT (datetime('now')), metadata TEXT NOT NULL DEFAULT '{}'
);
