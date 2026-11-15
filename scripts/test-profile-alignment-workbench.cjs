// Both profile and Assistant now share the same alignment view. Keep this entry point
// for existing PROFILE_WEB_URL workflows; the suite uses isolated HTTP fixtures.
process.env.DECISION_WEB_URL ||= process.env.PROFILE_WEB_URL || 'http://127.0.0.1:5200';
require('./test-assistant-decision-panels.cjs');
