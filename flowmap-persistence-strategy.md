# FlowMap Persistence Strategy

## Overview

FlowMap should treat SQL as the canonical source of truth for all durable knowledge objects, but it should not rely on a single local database file as the only protection against data loss.[cite:75][web:119][web:131] A local SQL database can be an excellent primary store for a knowledge-heavy product, especially in a local-first or single-user phase, but long-term reliability depends on backup, recovery, and export strategy as much as on the database engine itself.[web:120][web:119][web:127]

The recommended architecture is a layered persistence model: SQL for primary storage, scheduled backups to a separate location, export snapshots for portability and disaster recovery, and a future migration path to PostgreSQL when collaboration, server workers, or operational criticality increase.[web:119][web:125][web:127]

## Core recommendation

The strongest default for FlowMap is:

- Use SQL as the canonical database for all core product data.[cite:75]
- Start with SQLite if the product is local-first or single-user.[web:120][web:121]
- Add automated off-device backups immediately.[web:119][web:125]
- Add versioned exports in JSON or SQL dump format.[web:125][web:131]
- Move to PostgreSQL when FlowMap becomes multi-user, server-hosted, or operationally critical.[web:127]

This approach protects durability without forcing unnecessary infrastructure too early.[web:120][web:127]

## Why local SQL alone is not enough

A local SQL database is one component of durability, not the full solution.[web:119][web:131] If the machine fails, the file is corrupted, the disk is lost, or the user accidentally deletes the database, data can still be lost unless there are separate backups and tested restore paths.[web:119][web:125][web:131]

SQLite in particular can be reliable, but its safety depends on correct durability settings, careful handling of WAL mode, and backup methods that account for journal state and checkpoint behavior.[web:120][web:119][web:126] That means the question is not just “Should everything be in SQL?” but “What is the full data protection strategy around the SQL database?”[web:119][web:131]

## Storage principles

FlowMap should follow five storage principles.

### 1. SQL is the source of truth

All durable application state should be represented in normalized SQL tables, not only in caches, browser storage, or transient graph state.[cite:75]

### 2. Derived data can be rebuilt

Anything that can be regenerated from core tables should be treated as a derived layer. That includes graph projections, search indices, caches, recommendation views, embeddings, and denormalized read models.[cite:75]

### 3. Backups must live elsewhere

A backup on the same disk is better than nothing, but it is not sufficient disaster protection. Backups should be stored on a separate device, cloud bucket, or protected backup location.[web:125][web:131]

### 4. Restores matter more than backups

A backup strategy is incomplete until restore has been tested. Database backup guidance consistently emphasizes recovery readiness, not just backup creation.[web:125][web:131]

### 5. Export portability is required

The user’s knowledge base should be portable. FlowMap should support exportable snapshots so that data can be moved, audited, archived, or restored outside the live product stack.[web:125][cite:75]

## Recommended architecture by phase

### Phase 1: Local-first or solo product

For a local-first build or early single-user product, SQLite is an acceptable primary database because it is simple, embedded, file-based, and easy to ship with the app.[web:120][web:121] In this phase, the main hard requirement is to add proper backup automation and avoid treating the single `.db` file as the only copy of the knowledge base.[web:119][web:125]

#### Recommended stack

| Layer | Recommendation |
|---|---|
| Primary DB | SQLite [web:120] |
| Journal mode | WAL with deliberate backup handling [web:120] |
| App cache | Separate disposable cache store |
| Search index | Rebuildable derived store |
| Backups | Scheduled off-device file copies or snapshots [web:119][web:125] |
| Export | JSON + SQL dump |

### Phase 2: Hosted single-tenant or early team usage

Once FlowMap runs on a server with background jobs, ingestion workers, and multi-session access, PostgreSQL becomes a stronger fit because it offers more robust concurrency, server-native tooling, and better operational scaling characteristics.[web:127] At this phase, SQLite may still work in some deployments, but the operational complexity starts to favor a server database.[web:127]

### Phase 3: Multi-user product or mission-critical knowledge base

At the point where FlowMap becomes shared, collaborative, or business-critical, PostgreSQL should become the primary database, with managed backups, point-in-time recovery where possible, and stricter operational controls.[web:127][web:125] This phase should also include stronger observability, migration discipline, and recovery testing.[web:125]

## What must be stored in SQL

Everything that represents durable knowledge, memory, or user state should live in SQL.[cite:75] This includes both the knowledge base itself and the control structures around it.

### Core durable entities

- Topics
- Categories
- Tags
- Content items
- Content sources
- Saved articles and videos
- Topic-content relationships
- Entities and concepts
- Graph nodes and graph edges
- User memory evidence
- Source preferences
- Search/save/dismiss feedback events
- Manual URL ingest drafts and saved items
- Fetch history and provenance
- Collections and curated lists
- Learning cards and learning-path links[cite:75]

### Recommended canonical tables

| Table | Purpose |
|---|---|
| `topics` | Canonical tracked subjects |
| `categories` | Higher-level topic grouping |
| `tags` | Flexible labels for filtering and context |
| `content_items` | Normalized articles and videos |
| `content_sources` | Source/provider metadata |
| `topic_content` | Many-to-many topic-content relationship |
| `entities` | Tools, companies, creators, concepts |
| `content_entities` | Relationships between content and entities |
| `graph_nodes` | Graph read model nodes |
| `graph_edges` | Graph read model edges |
| `memory_evidence` | Signals created from saves, opens, follows, dismissals |
| `interest_profiles` | Materialized user/topic preference summaries |
| `manual_ingest_drafts` | URL preview draft records before save |
| `content_provenance` | Search, crawler, or manual ingest origin details |
| `collections` | User-curated groups |
| `collection_items` | Membership table for saved collections |
| `fetch_jobs` | Retrieval status and diagnostics |
| `exports` | Audit trail for backup/export generation |

## What should not be your only copy

Some data stores can exist in the system, but they should not be the only durable copy of knowledge base data.[cite:75]

### Unsafe as sole storage

- Browser localStorage
- IndexedDB-only storage without authoritative sync
- In-memory graph state
- Search index only
- Embedding store only
- Cache layer only
- Queue payloads only[cite:75]

These layers are useful, but they should be rebuildable or disposable.[cite:75]

## SQLite guidance for FlowMap

SQLite is a reasonable starting point, but it needs guardrails.[web:120][web:119][web:126]

### Recommended SQLite practices

- Use SQLite as the canonical primary database only in the early local-first or solo phase.[web:120][web:121]
- Enable WAL mode for better write concurrency and general behavior, but design backups with WAL awareness.[web:120]
- Keep the database file in a protected app data directory, not a casual temp path.
- Schedule file-level backups and snapshot exports frequently.[web:119]
- Run integrity checks regularly.
- Keep schema migrations versioned and reversible.

### Cautions

WAL mode changes how backups must be handled because the live state may span the main database file and WAL file until checkpointed.[web:120][web:119] SQLite durability can also vary depending on settings and environment behavior, which is why backup and recovery planning matters so much.[web:126]

## Backup strategy

FlowMap should implement layered backups from the start.[web:119][web:125][web:131]

### Minimum viable backup plan

- Local rolling backups every few hours.
- Daily off-device backup copy.
- Weekly full export snapshot.
- Retention policy for historical restore points.[web:125][web:131]

### Backup layers

| Layer | Purpose |
|---|---|
| Rolling local backup | Fast restore from recent mistakes or corruption |
| Off-device backup | Protection against machine failure or deletion |
| Structured export | Portability and migration safety |
| Schema migration archive | Recovery from bad releases |

### Backup rules

- Never overwrite the only good backup.
- Keep timestamped versions.
- Verify backup completion.
- Log backup failures.
- Test restore regularly.[web:125][web:131]

## Export strategy

Backups are for disaster recovery, but exports are for portability and auditability.[web:125] FlowMap should support both machine-oriented and human-usable exports.

### Recommended export formats

- SQL dump for full structural restore.
- JSON export for app portability and data migration.
- CSV export for selected content sets or collections.
- Optional markdown export for curated research collections.[cite:75][web:125]

### Export scope

Exports should be able to include:

- topics,
- content,
- tags,
- relationships,
- memory evidence,
- collections,
- manual adds,
- provenance metadata.[cite:75]

## Recovery strategy

The real test of persistence is not whether data is written, but whether it can be restored predictably after failure.[web:125][web:131] FlowMap should define recovery paths for the most common failure modes.

### Recovery scenarios

- Accidental deletion of a content item.
- Corruption of the local database.
- Failed migration.
- Device loss.
- Partial write failure during ingest.
- Broken graph projection or derived index.[web:125][cite:75]

### Recovery rules

- Restore canonical SQL first.
- Rebuild derived graph and search indices second.
- Replay incomplete ingest jobs only after core data is restored.[cite:75]

## Graph and search storage model

FlowMap should not treat the graph or search index as the only home of knowledge.[cite:75] The safer model is:

- SQL stores canonical facts.
- Graph nodes and edges are stored as durable read models, or regenerated from facts if needed.[cite:75]
- Search indices are derived and rebuildable.
- Embeddings, if used, are derived and rebuildable from canonical content.[cite:75]

This ensures that graph visualization failures or index corruption do not destroy the actual knowledge base.[cite:75]

## Write-path design

To avoid data loss, every durable action in the app should follow a predictable write path.

### Recommended write path

1. Validate input.
2. Write canonical row(s) to SQL inside a transaction.
3. Commit provenance and event log row.
4. Enqueue rebuild or projection jobs for graph/search/embeddings.
5. Confirm success to the user only after canonical commit succeeds.[cite:75]

This rule is especially important for:

- manual URL ingest,
- save to topic,
- memory updates,
- topic edits,
- collection changes,
- crawler ingestion.[cite:75]

## Suggested durability model by data type

| Data type | Canonical in SQL | Rebuildable | Backup priority |
|---|---|---|---|
| Topics | Yes | No | Critical |
| Saved content | Yes | No | Critical |
| Manual URL ingest drafts | Yes | Partly | High |
| Memory evidence | Yes | No | Critical |
| Graph projections | Prefer yes | Yes | Medium |
| Search index | No | Yes | Low |
| Embeddings | No | Yes | Low |
| Cache | No | Yes | Low |
| Export history | Yes | No | Medium |

## Migration path recommendation

FlowMap should be designed so that SQLite and PostgreSQL share the same logical schema as much as possible.[web:127] If the schema, migrations, and data-access layer stay portable, it becomes easier to start with SQLite and later promote to PostgreSQL without rewriting the entire storage model.[web:127]

### Practical migration plan

- Use conventional relational schemas and migration tooling.
- Avoid SQLite-only hacks in core tables.
- Treat graph/search as derived services around the canonical store.
- Keep export/import tools available at all times.[cite:75][web:127]

## Final recommendation

FlowMap should store all important knowledge base data in SQL, but it should not rely on local SQL alone as the full durability strategy.[web:119][web:131] The strongest near-term setup is SQLite as the canonical local-first database plus scheduled off-device backups, versioned exports, and rebuildable derived layers.[web:120][web:119][web:125]

As the product becomes multi-user, server-based, or operationally critical, PostgreSQL should become the primary database while preserving the same canonical data model and recovery principles.[web:127] This gives FlowMap a durable memory system without sacrificing a practical v1 architecture.[cite:75]
