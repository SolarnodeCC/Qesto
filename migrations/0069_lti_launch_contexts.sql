-- #587 — LTI launch-context store.
--
-- Grade passback (LTI Basic Outcomes) must use the LMS-signed outcome service URL
-- and result sourcedid captured at launch time, NOT values supplied by the
-- (attacker-controllable) passback request body. On a verified inbound launch we
-- persist the signed context keyed by (consumer_key, context_id, resource_link_id)
-- and look it up by resource_link_id at passback time.

CREATE TABLE IF NOT EXISTS lti_launch_contexts (
  id TEXT PRIMARY KEY,                                          -- ulid
  consumer_key TEXT NOT NULL,
  context_id TEXT,
  resource_link_id TEXT NOT NULL,
  lis_outcome_service_url TEXT,                                 -- signed grade-passback endpoint
  lis_result_sourcedid TEXT,                                    -- signed opaque result token
  lms_user_id TEXT,                                             -- LMS user_id from the launch
  roles TEXT,                                                   -- JSON array of LMS roles
  qesto_session_id TEXT,                                        -- bound Qesto session, if known
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(consumer_key, resource_link_id, lis_result_sourcedid)
);
CREATE INDEX IF NOT EXISTS idx_lti_launch_resource_link ON lti_launch_contexts(resource_link_id);
CREATE INDEX IF NOT EXISTS idx_lti_launch_consumer_context ON lti_launch_contexts(consumer_key, context_id);

PRAGMA foreign_key_check;
PRAGMA quick_check;
