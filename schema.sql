-- Unfuck Leads Database Schema
-- Unified lead tracking for all "Unfuck Your X" properties

CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Lead Source
    source TEXT NOT NULL,              -- 'reviews', 'web', 'ads', 'copy', etc.

    -- Contact Info
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    website TEXT,

    -- Lead Details
    problem TEXT,                      -- What's fucked?
    selected_issues TEXT,              -- JSON array or pipe-separated list
    issues_count INTEGER DEFAULT 0,

    -- Tracking
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    referrer TEXT,
    landing_page TEXT,

    -- Lead Status
    status TEXT DEFAULT 'new',         -- 'new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost'
    priority TEXT DEFAULT 'medium',    -- 'low', 'medium', 'high'

    -- Business Info (added during qualification)
    business_name TEXT,
    industry TEXT,
    estimated_revenue TEXT,

    -- Notes & Follow-up
    notes TEXT,
    next_action TEXT,
    next_action_date TEXT,

    -- Metadata
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    contacted_at TEXT,
    closed_at TEXT,

    -- IP and User Agent for spam detection
    ip_address TEXT,
    user_agent TEXT
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);

-- Activity log table for tracking interactions
CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL,
    activity_type TEXT NOT NULL,       -- 'email_sent', 'call_made', 'note_added', 'status_changed', etc.
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE INDEX IF NOT EXISTS idx_activity_lead_id ON activity_log(lead_id);
