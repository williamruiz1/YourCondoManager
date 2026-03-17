--
-- PostgreSQL database dump
--

\restrict kKbPzTM5j5DXMneu6Q7MDdOYTnyWlTYwggjXZvynMSw5tTAsTmmFF89swuMtGhj

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: admin_user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.admin_user_role AS ENUM (
    'platform-admin',
    'board-admin',
    'manager',
    'viewer'
);


--
-- Name: asset_condition; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.asset_condition AS ENUM (
    'excellent',
    'good',
    'fair',
    'poor',
    'unknown'
);


--
-- Name: autopay_enrollment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.autopay_enrollment_status AS ENUM (
    'active',
    'paused',
    'cancelled'
);


--
-- Name: autopay_frequency; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.autopay_frequency AS ENUM (
    'monthly',
    'quarterly',
    'annual'
);


--
-- Name: autopay_run_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.autopay_run_status AS ENUM (
    'success',
    'failed',
    'skipped'
);


--
-- Name: board_package_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.board_package_status AS ENUM (
    'draft',
    'approved',
    'distributed'
);


--
-- Name: budget_version_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.budget_version_status AS ENUM (
    'draft',
    'proposed',
    'ratified',
    'archived'
);


--
-- Name: collections_handoff_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.collections_handoff_status AS ENUM (
    'referred',
    'active',
    'settled',
    'withdrawn',
    'judgment'
);


--
-- Name: community_announcement_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.community_announcement_priority AS ENUM (
    'normal',
    'important',
    'urgent'
);


--
-- Name: compliance_alert_override_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.compliance_alert_override_status AS ENUM (
    'active',
    'suppressed',
    'resolved'
);


--
-- Name: compliance_template_scope; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.compliance_template_scope AS ENUM (
    'ct-baseline',
    'state-library',
    'association'
);


--
-- Name: contact_update_review_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.contact_update_review_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: delinquency_escalation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.delinquency_escalation_status AS ENUM (
    'active',
    'resolved',
    'referred',
    'on_payment_plan'
);


--
-- Name: executive_evidence_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.executive_evidence_type AS ENUM (
    'release-note',
    'metric',
    'screenshot',
    'link',
    'note'
);


--
-- Name: executive_source_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.executive_source_type AS ENUM (
    'manual',
    'roadmap-task',
    'roadmap-project'
);


--
-- Name: executive_update_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.executive_update_status AS ENUM (
    'draft',
    'published'
);


--
-- Name: expense_attachment_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.expense_attachment_type AS ENUM (
    'invoice',
    'utility-payment'
);


--
-- Name: extraction_review_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.extraction_review_status AS ENUM (
    'pending-review',
    'approved',
    'rejected'
);


--
-- Name: feature_flag_rollout_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.feature_flag_rollout_status AS ENUM (
    'global_off',
    'staged',
    'global_on'
);


--
-- Name: fee_frequency; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fee_frequency AS ENUM (
    'monthly',
    'quarterly',
    'annually',
    'one-time'
);


--
-- Name: financial_alert_severity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.financial_alert_severity AS ENUM (
    'info',
    'warning',
    'critical'
);


--
-- Name: financial_alert_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.financial_alert_type AS ENUM (
    'large_payment',
    'duplicate_payment',
    'negative_adjustment',
    'overdue_assessment',
    'reconciliation_gap',
    'budget_overage',
    'delinquency_spike',
    'expired_insurance_doc',
    'audit_anomaly'
);


--
-- Name: financial_approval_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.financial_approval_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'cancelled'
);


--
-- Name: governance_reminder_recipient; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.governance_reminder_recipient AS ENUM (
    'all_owners',
    'board_members',
    'managers',
    'meeting_attendees'
);


--
-- Name: governance_reminder_trigger; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.governance_reminder_trigger AS ENUM (
    'before_meeting',
    'after_meeting',
    'task_due',
    'board_term_expiry'
);


--
-- Name: governance_task_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.governance_task_status AS ENUM (
    'todo',
    'in-progress',
    'done'
);


--
-- Name: ingestion_import_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ingestion_import_mode AS ENUM (
    'preview',
    'commit'
);


--
-- Name: ingestion_job_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ingestion_job_status AS ENUM (
    'queued',
    'processing',
    'completed',
    'failed'
);


--
-- Name: ingestion_source_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ingestion_source_type AS ENUM (
    'file-upload',
    'pasted-text'
);


--
-- Name: inspection_condition; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.inspection_condition AS ENUM (
    'excellent',
    'good',
    'fair',
    'poor',
    'critical'
);


--
-- Name: inspection_finding_severity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.inspection_finding_severity AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);


--
-- Name: inspection_finding_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.inspection_finding_status AS ENUM (
    'open',
    'monitoring',
    'resolved'
);


--
-- Name: inspection_location_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.inspection_location_type AS ENUM (
    'unit',
    'common-area',
    'building'
);


--
-- Name: insurance_policy_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.insurance_policy_type AS ENUM (
    'master',
    'd-and-o',
    'fidelity-bond',
    'umbrella',
    'liability',
    'flood',
    'earthquake',
    'other'
);


--
-- Name: invoice_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoice_status AS ENUM (
    'draft',
    'received',
    'approved',
    'paid',
    'void'
);


--
-- Name: late_fee_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.late_fee_type AS ENUM (
    'flat',
    'percent'
);


--
-- Name: maintenance_frequency_unit; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.maintenance_frequency_unit AS ENUM (
    'month',
    'quarter',
    'year'
);


--
-- Name: maintenance_instance_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.maintenance_instance_status AS ENUM (
    'scheduled',
    'due',
    'converted',
    'completed',
    'skipped'
);


--
-- Name: maintenance_request_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.maintenance_request_priority AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);


--
-- Name: maintenance_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.maintenance_request_status AS ENUM (
    'submitted',
    'triaged',
    'in-progress',
    'resolved',
    'closed',
    'rejected'
);


--
-- Name: maintenance_schedule_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.maintenance_schedule_status AS ENUM (
    'active',
    'paused',
    'archived'
);


--
-- Name: meeting_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.meeting_status AS ENUM (
    'scheduled',
    'in-progress',
    'completed',
    'cancelled'
);


--
-- Name: meeting_summary_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.meeting_summary_status AS ENUM (
    'draft',
    'published'
);


--
-- Name: oauth_provider; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.oauth_provider AS ENUM (
    'google'
);


--
-- Name: occupancy_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.occupancy_type AS ENUM (
    'OWNER_OCCUPIED',
    'TENANT'
);


--
-- Name: onboarding_invite_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.onboarding_invite_status AS ENUM (
    'active',
    'submitted',
    'approved',
    'rejected',
    'expired',
    'revoked'
);


--
-- Name: onboarding_resident_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.onboarding_resident_type AS ENUM (
    'owner',
    'tenant'
);


--
-- Name: onboarding_submission_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.onboarding_submission_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: owner_ledger_entry_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.owner_ledger_entry_type AS ENUM (
    'charge',
    'assessment',
    'payment',
    'late-fee',
    'credit',
    'adjustment'
);


--
-- Name: owner_payment_link_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.owner_payment_link_status AS ENUM (
    'active',
    'paid',
    'expired',
    'void'
);


--
-- Name: payment_event_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_event_status AS ENUM (
    'received',
    'processed',
    'ignored',
    'failed'
);


--
-- Name: payment_gateway_provider; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_gateway_provider AS ENUM (
    'stripe',
    'other'
);


--
-- Name: payment_gateway_validation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_gateway_validation_status AS ENUM (
    'valid',
    'invalid'
);


--
-- Name: payment_plan_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_plan_status AS ENUM (
    'active',
    'completed',
    'defaulted',
    'cancelled'
);


--
-- Name: portal_access_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.portal_access_role AS ENUM (
    'owner',
    'tenant',
    'readonly',
    'board-member'
);


--
-- Name: portal_access_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.portal_access_status AS ENUM (
    'invited',
    'active',
    'suspended',
    'revoked',
    'expired'
);


--
-- Name: reconciliation_match_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.reconciliation_match_status AS ENUM (
    'unmatched',
    'auto_matched',
    'manual_matched',
    'disputed',
    'excluded'
);


--
-- Name: reconciliation_period_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.reconciliation_period_status AS ENUM (
    'open',
    'closed',
    'locked'
);


--
-- Name: recurring_charge_frequency; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.recurring_charge_frequency AS ENUM (
    'monthly',
    'quarterly',
    'annual'
);


--
-- Name: recurring_charge_run_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.recurring_charge_run_status AS ENUM (
    'pending',
    'success',
    'failed',
    'skipped',
    'retrying'
);


--
-- Name: recurring_charge_schedule_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.recurring_charge_schedule_status AS ENUM (
    'active',
    'paused',
    'archived'
);


--
-- Name: regulatory_publication_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.regulatory_publication_status AS ENUM (
    'draft',
    'review',
    'published',
    'archived'
);


--
-- Name: resident_feedback_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.resident_feedback_category AS ENUM (
    'maintenance',
    'management',
    'amenities',
    'communication',
    'neighbor',
    'financial',
    'general'
);


--
-- Name: resolution_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.resolution_status AS ENUM (
    'draft',
    'open',
    'approved',
    'rejected',
    'archived'
);


--
-- Name: roadmap_effort; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.roadmap_effort AS ENUM (
    'small',
    'medium',
    'large'
);


--
-- Name: roadmap_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.roadmap_priority AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);


--
-- Name: roadmap_project_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.roadmap_project_status AS ENUM (
    'active',
    'complete',
    'archived'
);


--
-- Name: roadmap_task_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.roadmap_task_status AS ENUM (
    'todo',
    'in-progress',
    'done'
);


--
-- Name: saved_payment_method_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.saved_payment_method_type AS ENUM (
    'ach',
    'card',
    'check',
    'zelle',
    'other'
);


--
-- Name: utility_payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.utility_payment_status AS ENUM (
    'due',
    'scheduled',
    'paid'
);


--
-- Name: vendor_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vendor_status AS ENUM (
    'active',
    'inactive',
    'pending-renewal'
);


--
-- Name: vote_choice; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vote_choice AS ENUM (
    'yes',
    'no',
    'abstain'
);


--
-- Name: work_order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.work_order_status AS ENUM (
    'open',
    'assigned',
    'in-progress',
    'pending-review',
    'closed',
    'cancelled'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_analysis_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_analysis_runs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    resource_id text NOT NULL,
    module text NOT NULL,
    action text NOT NULL,
    success integer DEFAULT 1 NOT NULL,
    duration_ms integer DEFAULT 0 NOT NULL,
    item_count integer DEFAULT 0 NOT NULL,
    error_message text,
    metadata_json jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_analysis_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_analysis_versions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    resource_id text NOT NULL,
    module text NOT NULL,
    version integer NOT NULL,
    payload_json jsonb NOT NULL,
    item_count integer DEFAULT 0 NOT NULL,
    trigger text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_association_scopes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_association_scopes (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    admin_user_id character varying NOT NULL,
    association_id character varying NOT NULL,
    scope text DEFAULT 'read-write'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_executive_evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_executive_evidence (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    executive_update_id character varying NOT NULL,
    evidence_type public.executive_evidence_type DEFAULT 'note'::public.executive_evidence_type NOT NULL,
    label text NOT NULL,
    value text NOT NULL,
    metadata_json jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_executive_updates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_executive_updates (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    headline text NOT NULL,
    summary text NOT NULL,
    business_value text,
    status public.executive_update_status DEFAULT 'draft'::public.executive_update_status NOT NULL,
    source_type public.executive_source_type DEFAULT 'manual'::public.executive_source_type NOT NULL,
    source_key text,
    project_id character varying,
    workstream_id character varying,
    task_id character varying,
    delivered_at timestamp without time zone,
    display_order integer DEFAULT 0 NOT NULL,
    created_by text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    problem_statement text,
    solution_summary text,
    features_delivered text[] DEFAULT '{}'::text[] NOT NULL
);


--
-- Name: admin_roadmap_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_roadmap_projects (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    status public.roadmap_project_status DEFAULT 'active'::public.roadmap_project_status NOT NULL,
    is_collapsed integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_roadmap_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_roadmap_tasks (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    project_id character varying NOT NULL,
    workstream_id character varying NOT NULL,
    title text NOT NULL,
    description text,
    status public.roadmap_task_status DEFAULT 'todo'::public.roadmap_task_status NOT NULL,
    effort public.roadmap_effort,
    priority public.roadmap_priority,
    dependency_task_ids text[] DEFAULT '{}'::text[] NOT NULL,
    target_start_date timestamp without time zone,
    target_end_date timestamp without time zone,
    completed_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_roadmap_workstreams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_roadmap_workstreams (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    project_id character varying NOT NULL,
    title text NOT NULL,
    description text,
    order_index integer DEFAULT 0 NOT NULL,
    is_collapsed integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    role public.admin_user_role DEFAULT 'viewer'::public.admin_user_role NOT NULL,
    is_active integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_extracted_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_extracted_records (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    job_id character varying NOT NULL,
    association_id character varying,
    record_type text NOT NULL,
    payload_json jsonb NOT NULL,
    confidence_score real,
    review_status public.extraction_review_status DEFAULT 'pending-review'::public.extraction_review_status NOT NULL,
    reviewed_by text,
    reviewed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    superseded_at timestamp without time zone
);


--
-- Name: ai_ingestion_import_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_ingestion_import_runs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    ingestion_job_id character varying NOT NULL,
    extracted_record_id character varying NOT NULL,
    association_id character varying,
    mode public.ingestion_import_mode NOT NULL,
    target_module text DEFAULT 'none'::text NOT NULL,
    run_status text DEFAULT 'recorded'::text NOT NULL,
    summary_json jsonb NOT NULL,
    created_entity_refs_json jsonb,
    actor_email text,
    error_message text,
    rolled_back_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_ingestion_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_ingestion_jobs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying,
    source_type public.ingestion_source_type NOT NULL,
    source_filename text,
    source_text text,
    source_file_url text,
    status public.ingestion_job_status DEFAULT 'queued'::public.ingestion_job_status NOT NULL,
    submitted_by text,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    error_message text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    context_notes text,
    source_document_id character varying
);


--
-- Name: annual_governance_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.annual_governance_tasks (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    template_id character varying,
    template_item_id character varying,
    title text NOT NULL,
    description text,
    status public.governance_task_status DEFAULT 'todo'::public.governance_task_status NOT NULL,
    owner_person_id character varying,
    due_date timestamp without time zone,
    completed_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    evidence_urls_json jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: association_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.association_assets (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    unit_id character varying,
    vendor_id character varying,
    name text NOT NULL,
    asset_type text NOT NULL,
    manufacturer text,
    model text,
    serial_number text,
    location text,
    install_date timestamp without time zone,
    warranty_expires_at timestamp without time zone,
    last_serviced_at timestamp without time zone,
    next_service_due_at timestamp without time zone,
    estimated_lifespan_years integer,
    replacement_cost_estimate real,
    condition public.asset_condition DEFAULT 'unknown'::public.asset_condition NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: association_feature_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.association_feature_flags (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    flag_id character varying NOT NULL,
    association_id character varying NOT NULL,
    enabled integer DEFAULT 0 NOT NULL,
    rollout_percent integer DEFAULT 100 NOT NULL,
    notes text,
    updated_by text,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: association_insurance_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.association_insurance_policies (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    policy_type public.insurance_policy_type NOT NULL,
    carrier text NOT NULL,
    policy_number text,
    effective_date timestamp without time zone,
    expiration_date timestamp without time zone,
    premium_amount real,
    coverage_amount real,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: association_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.association_memberships (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    person_id character varying NOT NULL,
    unit_id character varying,
    membership_type text DEFAULT 'owner'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    is_primary integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: associations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.associations (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    address text NOT NULL,
    city text NOT NULL,
    state text NOT NULL,
    country text DEFAULT 'USA'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    is_archived integer DEFAULT 0 NOT NULL,
    archived_at timestamp without time zone,
    association_type text,
    date_formed text,
    ein text
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    actor_email text NOT NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    association_id character varying,
    before_json jsonb,
    after_json jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: auth_external_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_external_accounts (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    provider public.oauth_provider NOT NULL,
    provider_account_id text NOT NULL,
    provider_email text,
    profile_json jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: auth_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    admin_user_id character varying,
    email text NOT NULL,
    first_name text,
    last_name text,
    avatar_url text,
    is_active integer DEFAULT 1 NOT NULL,
    last_login_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: autopay_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.autopay_enrollments (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    unit_id character varying NOT NULL,
    person_id character varying NOT NULL,
    amount real NOT NULL,
    frequency public.autopay_frequency DEFAULT 'monthly'::public.autopay_frequency NOT NULL,
    day_of_month integer DEFAULT 1 NOT NULL,
    status public.autopay_enrollment_status DEFAULT 'active'::public.autopay_enrollment_status NOT NULL,
    next_payment_date timestamp without time zone,
    description text DEFAULT 'Autopay HOA dues'::text NOT NULL,
    enrolled_by text,
    enrolled_at timestamp without time zone DEFAULT now() NOT NULL,
    cancelled_by text,
    cancelled_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: autopay_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.autopay_runs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    enrollment_id character varying NOT NULL,
    association_id character varying NOT NULL,
    amount real NOT NULL,
    status public.autopay_run_status DEFAULT 'success'::public.autopay_run_status NOT NULL,
    ledger_entry_id character varying,
    error_message text,
    ran_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: bank_statement_imports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_statement_imports (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    filename text NOT NULL,
    imported_by text,
    statement_date timestamp without time zone,
    opening_balance real,
    closing_balance real,
    transaction_count integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: bank_statement_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_statement_transactions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    import_id character varying NOT NULL,
    association_id character varying NOT NULL,
    transaction_date timestamp without time zone NOT NULL,
    description text NOT NULL,
    amount real NOT NULL,
    bank_reference text,
    check_number text,
    match_status public.reconciliation_match_status DEFAULT 'unmatched'::public.reconciliation_match_status NOT NULL,
    matched_ledger_entry_id character varying,
    matched_by text,
    matched_at timestamp without time zone,
    match_notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: board_package_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.board_package_templates (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    title text NOT NULL,
    frequency text DEFAULT 'monthly'::text NOT NULL,
    sections_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    auto_generate integer DEFAULT 0 NOT NULL,
    meeting_type text,
    generate_days_before integer DEFAULT 7 NOT NULL,
    last_auto_generated_at timestamp without time zone
);


--
-- Name: board_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.board_packages (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    template_id character varying,
    association_id character varying NOT NULL,
    title text NOT NULL,
    period_label text NOT NULL,
    status public.board_package_status DEFAULT 'draft'::public.board_package_status NOT NULL,
    content_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    annotations_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    meeting_id character varying,
    approved_by text,
    approved_at timestamp without time zone,
    distributed_by text,
    distributed_at timestamp without time zone
);


--
-- Name: board_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.board_roles (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    person_id character varying NOT NULL,
    association_id character varying NOT NULL,
    role text NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone
);


--
-- Name: budget_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budget_lines (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    budget_version_id character varying NOT NULL,
    account_id character varying,
    category_id character varying,
    line_item_name text NOT NULL,
    planned_amount real NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: budget_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budget_versions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    budget_id character varying NOT NULL,
    version_number integer NOT NULL,
    status public.budget_version_status DEFAULT 'draft'::public.budget_version_status NOT NULL,
    notes text,
    ratified_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budgets (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    name text NOT NULL,
    fiscal_year integer NOT NULL,
    period_start timestamp without time zone NOT NULL,
    period_end timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: buildings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.buildings (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    name text NOT NULL,
    address text NOT NULL,
    total_units integer,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: calendar_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_events (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    event_type text DEFAULT 'governance'::text NOT NULL,
    title text NOT NULL,
    starts_at timestamp without time zone NOT NULL,
    ends_at timestamp without time zone,
    related_type text,
    related_id text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: clause_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clause_records (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    ingestion_job_id character varying NOT NULL,
    extracted_record_id character varying,
    association_id character varying,
    source_document_id character varying,
    title text NOT NULL,
    clause_text text NOT NULL,
    confidence_score real,
    review_status public.extraction_review_status DEFAULT 'pending-review'::public.extraction_review_status NOT NULL,
    reviewed_by text,
    reviewed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    superseded_at timestamp without time zone
);


--
-- Name: clause_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clause_tags (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    clause_record_id character varying NOT NULL,
    tag text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: collections_handoffs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collections_handoffs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    unit_id character varying NOT NULL,
    person_id character varying NOT NULL,
    referral_date timestamp without time zone NOT NULL,
    referral_amount real NOT NULL,
    current_balance real NOT NULL,
    days_past_due integer DEFAULT 0 NOT NULL,
    status public.collections_handoff_status DEFAULT 'referred'::public.collections_handoff_status NOT NULL,
    agency_name text,
    agency_contact_name text,
    agency_email text,
    agency_phone text,
    agency_case_number text,
    settlement_amount real,
    settlement_date timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: communication_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.communication_history (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying,
    channel text DEFAULT 'email'::text NOT NULL,
    direction text DEFAULT 'outbound'::text NOT NULL,
    subject text,
    body_snippet text,
    recipient_email text,
    recipient_person_id character varying,
    related_type text,
    related_id text,
    metadata_json jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: community_announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.community_announcements (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    priority public.community_announcement_priority DEFAULT 'normal'::public.community_announcement_priority NOT NULL,
    author_name text,
    published_at timestamp without time zone,
    expires_at timestamp without time zone,
    is_pinned integer DEFAULT 0 NOT NULL,
    is_published integer DEFAULT 0 NOT NULL,
    target_audience text DEFAULT 'all'::text NOT NULL,
    created_by text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: compliance_alert_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_alert_overrides (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    template_id character varying,
    template_item_id character varying NOT NULL,
    status public.compliance_alert_override_status DEFAULT 'active'::public.compliance_alert_override_status NOT NULL,
    suppression_reason text,
    suppressed_until timestamp without time zone,
    notes text,
    created_by text,
    updated_by text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: contact_update_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_update_requests (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    portal_access_id character varying NOT NULL,
    person_id character varying NOT NULL,
    request_json jsonb NOT NULL,
    review_status public.contact_update_review_status DEFAULT 'pending'::public.contact_update_review_status NOT NULL,
    reviewed_by text,
    reviewed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: delinquency_escalations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delinquency_escalations (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    person_id character varying NOT NULL,
    unit_id character varying NOT NULL,
    current_stage integer DEFAULT 1 NOT NULL,
    balance real NOT NULL,
    days_past_due integer DEFAULT 0 NOT NULL,
    status public.delinquency_escalation_status DEFAULT 'active'::public.delinquency_escalation_status NOT NULL,
    last_notice_at timestamp without time zone,
    next_action_at timestamp without time zone,
    resolved_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: delinquency_thresholds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delinquency_thresholds (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    stage integer NOT NULL,
    stage_name text NOT NULL,
    minimum_balance real DEFAULT 0 NOT NULL,
    minimum_days_overdue integer DEFAULT 30 NOT NULL,
    action_type text DEFAULT 'notice'::text NOT NULL,
    notice_template_id character varying,
    late_fee_pct real,
    late_fee_flat real,
    is_active integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: document_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_tags (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    document_id character varying NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: document_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_versions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    document_id character varying NOT NULL,
    version_number integer NOT NULL,
    title text NOT NULL,
    file_url text NOT NULL,
    uploaded_by text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    title text NOT NULL,
    file_url text NOT NULL,
    document_type text NOT NULL,
    uploaded_by text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    is_portal_visible integer DEFAULT 0 NOT NULL,
    portal_audience text DEFAULT 'owner'::text NOT NULL
);


--
-- Name: email_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_events (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    email_log_id character varying NOT NULL,
    event_type text NOT NULL,
    url text,
    ip_address text,
    user_agent text,
    occurred_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: email_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_logs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying,
    to_address text NOT NULL,
    cc_addresses jsonb DEFAULT '[]'::jsonb NOT NULL,
    bcc_addresses jsonb DEFAULT '[]'::jsonb NOT NULL,
    subject text NOT NULL,
    template_key text,
    status text DEFAULT 'queued'::text NOT NULL,
    provider text DEFAULT 'internal-mock'::text NOT NULL,
    provider_message_id text,
    error_message text,
    metadata_json jsonb,
    tracking_token text,
    sent_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: email_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_threads (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    subject text NOT NULL,
    participants_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    source text DEFAULT 'internal'::text NOT NULL,
    last_message_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: expense_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_attachments (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    expense_type public.expense_attachment_type NOT NULL,
    expense_id text NOT NULL,
    title text NOT NULL,
    file_url text NOT NULL,
    uploaded_by text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: feature_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feature_flags (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    description text,
    default_enabled integer DEFAULT 0 NOT NULL,
    rollout_status public.feature_flag_rollout_status DEFAULT 'staged'::public.feature_flag_rollout_status NOT NULL,
    created_by text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: financial_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_accounts (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    name text NOT NULL,
    account_code text,
    account_type text DEFAULT 'expense'::text NOT NULL,
    is_active integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: financial_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_alerts (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    alert_type public.financial_alert_type NOT NULL,
    severity public.financial_alert_severity DEFAULT 'warning'::public.financial_alert_severity NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    entity_type text,
    entity_id text,
    amount real,
    is_read integer DEFAULT 0 NOT NULL,
    is_dismissed integer DEFAULT 0 NOT NULL,
    dismissed_by text,
    dismissed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: financial_approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_approvals (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    requested_by text NOT NULL,
    approver_id character varying,
    status public.financial_approval_status DEFAULT 'pending'::public.financial_approval_status NOT NULL,
    change_type text NOT NULL,
    change_description text NOT NULL,
    change_amount real,
    change_payload_json jsonb,
    required_approvers integer DEFAULT 2 NOT NULL,
    approved_by text,
    resolved_at timestamp without time zone,
    resolver_notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: financial_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_categories (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    name text NOT NULL,
    category_type text DEFAULT 'expense'::text NOT NULL,
    is_active integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: governance_compliance_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.governance_compliance_templates (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying,
    scope public.compliance_template_scope DEFAULT 'ct-baseline'::public.compliance_template_scope NOT NULL,
    year integer NOT NULL,
    name text NOT NULL,
    created_by text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    base_template_id character varying,
    state_code text,
    version_number integer DEFAULT 1 NOT NULL,
    source_authority text,
    source_url text,
    source_document_title text,
    source_document_date timestamp without time zone,
    effective_date timestamp without time zone,
    last_source_updated_at timestamp without time zone,
    last_verified_at timestamp without time zone,
    last_synced_at timestamp without time zone,
    next_review_due_at timestamp without time zone,
    publication_status public.regulatory_publication_status DEFAULT 'draft'::public.regulatory_publication_status NOT NULL,
    published_at timestamp without time zone,
    review_notes text
);


--
-- Name: governance_meetings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.governance_meetings (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    meeting_type text NOT NULL,
    title text NOT NULL,
    scheduled_at timestamp without time zone NOT NULL,
    location text,
    status public.meeting_status DEFAULT 'scheduled'::public.meeting_status NOT NULL,
    agenda text,
    notes text,
    summary_text text,
    summary_status public.meeting_summary_status DEFAULT 'draft'::public.meeting_summary_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: governance_reminder_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.governance_reminder_rules (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    name text NOT NULL,
    trigger public.governance_reminder_trigger NOT NULL,
    days_offset integer DEFAULT 3 NOT NULL,
    recipient_type public.governance_reminder_recipient DEFAULT 'all_owners'::public.governance_reminder_recipient NOT NULL,
    subject_template text NOT NULL,
    body_template text NOT NULL,
    meeting_types text,
    is_active integer DEFAULT 1 NOT NULL,
    last_run_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: governance_template_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.governance_template_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    template_id character varying NOT NULL,
    title text NOT NULL,
    description text,
    due_month integer NOT NULL,
    due_day integer NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    legal_reference text,
    source_citation text,
    source_url text
);


--
-- Name: hoa_fee_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hoa_fee_schedules (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    name text NOT NULL,
    amount real NOT NULL,
    frequency public.fee_frequency DEFAULT 'monthly'::public.fee_frequency NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone,
    grace_days integer DEFAULT 0 NOT NULL,
    is_active integer DEFAULT 1 NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: inspection_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inspection_records (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    unit_id character varying,
    location_type public.inspection_location_type DEFAULT 'unit'::public.inspection_location_type NOT NULL,
    location_text text NOT NULL,
    inspection_type text DEFAULT 'routine'::text NOT NULL,
    inspector_name text NOT NULL,
    overall_condition public.inspection_condition DEFAULT 'good'::public.inspection_condition NOT NULL,
    summary text,
    inspected_at timestamp without time zone DEFAULT now() NOT NULL,
    findings_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: late_fee_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.late_fee_events (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    rule_id character varying NOT NULL,
    reference_type text,
    reference_id text,
    balance_amount real NOT NULL,
    due_date timestamp without time zone NOT NULL,
    as_of_date timestamp without time zone NOT NULL,
    calculated_fee real NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: late_fee_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.late_fee_rules (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    name text NOT NULL,
    fee_type public.late_fee_type DEFAULT 'flat'::public.late_fee_type NOT NULL,
    fee_amount real NOT NULL,
    grace_days integer DEFAULT 0 NOT NULL,
    max_fee real,
    is_active integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: maintenance_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_requests (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    unit_id character varying,
    submitted_by_person_id character varying,
    submitted_by_portal_access_id character varying,
    submitted_by_email text,
    title text NOT NULL,
    description text NOT NULL,
    location_text text,
    category text DEFAULT 'general'::text NOT NULL,
    priority public.maintenance_request_priority DEFAULT 'medium'::public.maintenance_request_priority NOT NULL,
    status public.maintenance_request_status DEFAULT 'submitted'::public.maintenance_request_status NOT NULL,
    attachment_urls_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    assigned_to text,
    resolution_notes text,
    response_due_at timestamp without time zone,
    escalation_stage integer DEFAULT 0 NOT NULL,
    escalated_at timestamp without time zone,
    last_escalation_notice_at timestamp without time zone,
    triaged_at timestamp without time zone,
    resolved_at timestamp without time zone,
    closed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: maintenance_schedule_instances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_schedule_instances (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    template_id character varying NOT NULL,
    association_id character varying NOT NULL,
    unit_id character varying,
    vendor_id character varying,
    work_order_id character varying,
    title text NOT NULL,
    component text NOT NULL,
    location_text text NOT NULL,
    due_at timestamp without time zone NOT NULL,
    status public.maintenance_instance_status DEFAULT 'scheduled'::public.maintenance_instance_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: maintenance_schedule_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_schedule_templates (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    unit_id character varying,
    vendor_id character varying,
    title text NOT NULL,
    component text NOT NULL,
    description text,
    location_text text NOT NULL,
    frequency_unit public.maintenance_frequency_unit DEFAULT 'quarter'::public.maintenance_frequency_unit NOT NULL,
    frequency_interval integer DEFAULT 1 NOT NULL,
    responsible_party text,
    auto_create_work_order integer DEFAULT 0 NOT NULL,
    next_due_at timestamp without time zone NOT NULL,
    status public.maintenance_schedule_status DEFAULT 'active'::public.maintenance_schedule_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: meeting_agenda_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meeting_agenda_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    meeting_id character varying NOT NULL,
    title text NOT NULL,
    description text,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: meeting_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meeting_notes (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    meeting_id character varying NOT NULL,
    note_type text DEFAULT 'general'::text NOT NULL,
    content text NOT NULL,
    created_by text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: notice_sends; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notice_sends (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying,
    template_id character varying,
    recipient_email text NOT NULL,
    recipient_person_id character varying,
    subject_rendered text NOT NULL,
    body_rendered text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    provider text DEFAULT 'internal-mock'::text NOT NULL,
    provider_message_id text,
    sent_by text,
    sent_at timestamp without time zone DEFAULT now() NOT NULL,
    campaign_key text,
    metadata_json jsonb,
    delivered_at timestamp without time zone,
    opened_at timestamp without time zone,
    bounced_at timestamp without time zone,
    bounce_type text,
    bounce_reason text,
    retry_count integer DEFAULT 0 NOT NULL,
    last_retry_at timestamp without time zone
);


--
-- Name: notice_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notice_templates (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying,
    name text NOT NULL,
    channel text DEFAULT 'email'::text NOT NULL,
    subject_template text NOT NULL,
    body_template text NOT NULL,
    is_active integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    header_template text,
    footer_template text,
    signature_template text
);


--
-- Name: occupancies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.occupancies (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    unit_id character varying NOT NULL,
    person_id character varying NOT NULL,
    occupancy_type public.occupancy_type NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone
);


--
-- Name: onboarding_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_invites (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    unit_id character varying NOT NULL,
    resident_type public.onboarding_resident_type NOT NULL,
    email text,
    phone text,
    delivery_channel text DEFAULT 'link'::text NOT NULL,
    token text NOT NULL,
    status public.onboarding_invite_status DEFAULT 'active'::public.onboarding_invite_status NOT NULL,
    expires_at timestamp without time zone,
    created_by text,
    last_sent_at timestamp without time zone,
    submitted_at timestamp without time zone,
    approved_at timestamp without time zone,
    rejected_at timestamp without time zone,
    revoked_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: onboarding_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_submissions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    invite_id character varying,
    association_id character varying NOT NULL,
    unit_id character varying NOT NULL,
    resident_type public.onboarding_resident_type NOT NULL,
    source_channel text DEFAULT 'unit-link'::text NOT NULL,
    status public.onboarding_submission_status DEFAULT 'pending'::public.onboarding_submission_status NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text,
    phone text,
    mailing_address text,
    emergency_contact_name text,
    emergency_contact_phone text,
    contact_preference text DEFAULT 'email'::text NOT NULL,
    start_date timestamp without time zone NOT NULL,
    ownership_percentage real,
    submitted_at timestamp without time zone DEFAULT now() NOT NULL,
    reviewed_by text,
    reviewed_at timestamp without time zone,
    rejection_reason text,
    created_person_id character varying,
    created_occupancy_id character varying,
    created_ownership_id character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    occupancy_intent text,
    additional_owners_json jsonb,
    tenant_residents_json jsonb
);


--
-- Name: owner_ledger_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.owner_ledger_entries (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    unit_id character varying NOT NULL,
    person_id character varying NOT NULL,
    entry_type public.owner_ledger_entry_type NOT NULL,
    amount real NOT NULL,
    posted_at timestamp without time zone NOT NULL,
    description text,
    reference_type text,
    reference_id text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: owner_payment_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.owner_payment_links (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    token text NOT NULL,
    association_id character varying NOT NULL,
    unit_id character varying NOT NULL,
    person_id character varying NOT NULL,
    amount real NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    status public.owner_payment_link_status DEFAULT 'active'::public.owner_payment_link_status NOT NULL,
    allow_partial integer DEFAULT 0 NOT NULL,
    memo text,
    expires_at timestamp without time zone,
    paid_at timestamp without time zone,
    voided_at timestamp without time zone,
    metadata_json jsonb,
    created_by text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: ownerships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ownerships (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    unit_id character varying NOT NULL,
    person_id character varying NOT NULL,
    ownership_percentage real DEFAULT 100 NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone
);


--
-- Name: partial_payment_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partial_payment_rules (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    allow_partial_payments integer DEFAULT 1 NOT NULL,
    minimum_payment_amount real,
    minimum_payment_percent real,
    require_payment_confirmation integer DEFAULT 1 NOT NULL,
    send_receipt_email integer DEFAULT 1 NOT NULL,
    receipt_email_template text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_event_transitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_event_transitions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    webhook_event_id character varying NOT NULL,
    from_status text NOT NULL,
    to_status text NOT NULL,
    reason text,
    transitioned_at timestamp without time zone DEFAULT now() NOT NULL,
    transitioned_by text DEFAULT 'system'::text NOT NULL
);


--
-- Name: payment_gateway_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_gateway_connections (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    provider public.payment_gateway_provider DEFAULT 'stripe'::public.payment_gateway_provider NOT NULL,
    provider_account_id text,
    publishable_key text,
    secret_key_masked text,
    webhook_secret_masked text,
    validation_status public.payment_gateway_validation_status DEFAULT 'valid'::public.payment_gateway_validation_status NOT NULL,
    validation_message text,
    is_active integer DEFAULT 1 NOT NULL,
    last_validated_at timestamp without time zone,
    metadata_json jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_method_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_method_configs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    method_type text DEFAULT 'other'::text NOT NULL,
    display_name text NOT NULL,
    instructions text NOT NULL,
    support_email text,
    support_phone text,
    is_active integer DEFAULT 1 NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    account_name text,
    bank_name text,
    routing_number text,
    account_number text,
    mailing_address text,
    payment_notes text,
    zelle_handle text
);


--
-- Name: payment_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_plans (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    unit_id character varying NOT NULL,
    person_id character varying NOT NULL,
    total_amount real NOT NULL,
    amount_paid real DEFAULT 0 NOT NULL,
    installment_amount real NOT NULL,
    installment_frequency text DEFAULT 'monthly'::text NOT NULL,
    start_date timestamp without time zone NOT NULL,
    next_due_date timestamp without time zone,
    end_date timestamp without time zone,
    status public.payment_plan_status DEFAULT 'active'::public.payment_plan_status NOT NULL,
    notes text,
    created_by text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_reminder_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_reminder_rules (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    name text NOT NULL,
    template_id character varying,
    days_relative_to_due integer DEFAULT 0 NOT NULL,
    trigger_on text DEFAULT 'overdue'::text NOT NULL,
    min_balance_threshold real DEFAULT 0 NOT NULL,
    is_active integer DEFAULT 1 NOT NULL,
    last_run_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_webhook_events (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    provider public.payment_gateway_provider DEFAULT 'stripe'::public.payment_gateway_provider NOT NULL,
    provider_event_id text NOT NULL,
    payment_link_id character varying,
    unit_id character varying,
    person_id character varying,
    amount real,
    currency text DEFAULT 'USD'::text,
    status public.payment_event_status DEFAULT 'received'::public.payment_event_status NOT NULL,
    event_type text,
    gateway_reference text,
    raw_payload_json jsonb,
    processed_at timestamp without time zone,
    owner_ledger_entry_id text,
    error_message text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: permission_change_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission_change_logs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    old_role public.admin_user_role NOT NULL,
    new_role public.admin_user_role NOT NULL,
    changed_by text NOT NULL,
    reason text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: permission_envelopes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission_envelopes (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying,
    name text NOT NULL,
    audience text DEFAULT 'owner-self-service'::text NOT NULL,
    permissions_json jsonb NOT NULL,
    is_active integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: persons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persons (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text,
    phone text,
    mailing_address text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    emergency_contact_name text,
    emergency_contact_phone text,
    contact_preference text DEFAULT 'email'::text NOT NULL,
    association_id character varying
);


--
-- Name: portal_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portal_access (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    person_id character varying NOT NULL,
    unit_id character varying,
    email text NOT NULL,
    role public.portal_access_role DEFAULT 'owner'::public.portal_access_role NOT NULL,
    status public.portal_access_status DEFAULT 'active'::public.portal_access_status NOT NULL,
    last_login_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    board_role_id character varying,
    invited_by text,
    invited_at timestamp without time zone,
    accepted_at timestamp without time zone,
    suspended_at timestamp without time zone,
    revoked_at timestamp without time zone
);


--
-- Name: portal_login_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portal_login_tokens (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    email text NOT NULL,
    otp_hash text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone,
    attempts integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: reconciliation_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reconciliation_periods (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    period_label text NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone NOT NULL,
    status public.reconciliation_period_status DEFAULT 'open'::public.reconciliation_period_status NOT NULL,
    import_id character varying,
    closed_by text,
    closed_at timestamp without time zone,
    locked_by text,
    locked_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: recurring_charge_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recurring_charge_runs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    schedule_id character varying NOT NULL,
    association_id character varying NOT NULL,
    unit_id character varying,
    amount real NOT NULL,
    status public.recurring_charge_run_status DEFAULT 'pending'::public.recurring_charge_run_status NOT NULL,
    ledger_entry_id character varying,
    error_message text,
    retry_count integer DEFAULT 0 NOT NULL,
    next_retry_at timestamp without time zone,
    ran_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: recurring_charge_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recurring_charge_schedules (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    unit_id character varying,
    charge_description text NOT NULL,
    entry_type public.owner_ledger_entry_type DEFAULT 'charge'::public.owner_ledger_entry_type NOT NULL,
    amount real NOT NULL,
    frequency public.recurring_charge_frequency DEFAULT 'monthly'::public.recurring_charge_frequency NOT NULL,
    day_of_month integer DEFAULT 1 NOT NULL,
    next_run_date timestamp without time zone,
    status public.recurring_charge_schedule_status DEFAULT 'active'::public.recurring_charge_schedule_status NOT NULL,
    max_retries integer DEFAULT 3 NOT NULL,
    created_by text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: resident_feedbacks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resident_feedbacks (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    unit_id character varying,
    person_id character varying,
    category public.resident_feedback_category DEFAULT 'general'::public.resident_feedback_category NOT NULL,
    satisfaction_score integer,
    subject text,
    feedback_text text,
    is_anonymous integer DEFAULT 0 NOT NULL,
    admin_notes text,
    status text DEFAULT 'open'::text NOT NULL,
    resolved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: resolutions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resolutions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    meeting_id character varying,
    title text NOT NULL,
    description text,
    status public.resolution_status DEFAULT 'draft'::public.resolution_status NOT NULL,
    passed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: saved_payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_payment_methods (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    person_id character varying NOT NULL,
    method_type public.saved_payment_method_type DEFAULT 'ach'::public.saved_payment_method_type NOT NULL,
    display_name text NOT NULL,
    last4 text,
    bank_name text,
    external_token_ref text,
    is_default integer DEFAULT 0 NOT NULL,
    is_active integer DEFAULT 1 NOT NULL,
    added_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: special_assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.special_assessments (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    name text NOT NULL,
    total_amount real NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone,
    installment_count integer DEFAULT 1 NOT NULL,
    notes text,
    is_active integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: suggested_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suggested_links (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    clause_record_id character varying NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    confidence_score real,
    is_approved integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tenant_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_configs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    portal_name text DEFAULT 'Owner Portal'::text NOT NULL,
    support_email text,
    allow_contact_updates integer DEFAULT 1 NOT NULL,
    owner_document_visibility text DEFAULT 'owner-safe'::text NOT NULL,
    gmail_integration_status text DEFAULT 'not-configured'::text NOT NULL,
    default_notice_footer text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    ai_ingestion_rollout_mode text DEFAULT 'full'::text NOT NULL,
    ai_ingestion_canary_percent integer DEFAULT 100 NOT NULL,
    ai_ingestion_rollout_notes text,
    management_type text DEFAULT 'self-managed'::text NOT NULL,
    management_company_name text
);


--
-- Name: unit_change_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_change_history (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    unit_id character varying NOT NULL,
    field_name text NOT NULL,
    old_value text,
    new_value text,
    changed_by text DEFAULT 'system'::text NOT NULL,
    changed_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.units (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    unit_number text NOT NULL,
    building text,
    square_footage real,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    building_id character varying
);


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_sessions (
    sid character varying NOT NULL,
    sess jsonb NOT NULL,
    expire timestamp without time zone NOT NULL
);


--
-- Name: utility_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.utility_payments (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    utility_type text NOT NULL,
    provider_name text NOT NULL,
    service_period_start timestamp without time zone,
    service_period_end timestamp without time zone,
    due_date timestamp without time zone,
    paid_date timestamp without time zone,
    amount real NOT NULL,
    status public.utility_payment_status DEFAULT 'due'::public.utility_payment_status NOT NULL,
    account_id character varying,
    category_id character varying,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: vendor_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_invoices (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    vendor_name text NOT NULL,
    invoice_number text,
    invoice_date timestamp without time zone NOT NULL,
    due_date timestamp without time zone,
    amount real NOT NULL,
    status public.invoice_status DEFAULT 'received'::public.invoice_status NOT NULL,
    account_id character varying,
    category_id character varying,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    vendor_id character varying
);


--
-- Name: vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendors (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    name text NOT NULL,
    trade text DEFAULT 'general'::text NOT NULL,
    service_area text,
    primary_contact_name text,
    primary_email text,
    primary_phone text,
    license_number text,
    insurance_expires_at timestamp without time zone,
    status public.vendor_status DEFAULT 'active'::public.vendor_status NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: vote_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vote_records (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    resolution_id character varying NOT NULL,
    voter_person_id character varying,
    vote_choice public.vote_choice NOT NULL,
    vote_weight real DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: webhook_signing_secrets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_signing_secrets (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    secret_hash text NOT NULL,
    secret_hint text,
    provider text DEFAULT 'generic'::text NOT NULL,
    is_active integer DEFAULT 1 NOT NULL,
    rotated_at timestamp without time zone,
    created_by text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: work_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_orders (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    association_id character varying NOT NULL,
    maintenance_request_id character varying,
    unit_id character varying,
    vendor_id character varying,
    vendor_invoice_id character varying,
    title text NOT NULL,
    description text NOT NULL,
    location_text text,
    category text DEFAULT 'general'::text NOT NULL,
    priority public.maintenance_request_priority DEFAULT 'medium'::public.maintenance_request_priority NOT NULL,
    status public.work_order_status DEFAULT 'open'::public.work_order_status NOT NULL,
    assigned_to text,
    estimated_cost real,
    actual_cost real,
    scheduled_for timestamp without time zone,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    resolution_notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    photos_json jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Data for Name: admin_analysis_runs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.admin_analysis_runs (id, resource_id, module, action, success, duration_ms, item_count, error_message, metadata_json, created_at) FROM stdin;
51db1175-dba5-43fd-9e33-8c6ef3560f82	admin-roadmap-backbone	agent-bootstrap-backbone	friction-observed	1	0	1	\N	{"impact": "Typecheck is not a clean pass/fail signal for unrelated slices.", "source": "npm run check", "summary": "TypeScript verification is currently degraded by pre-existing server/storage.ts issues, so backbone work needs alternate validation signals.", "category": "verification", "repeatable": "yes", "couldPrecompute": "yes"}	2026-03-15 14:21:43.661434
c60b6b6a-a26e-4945-b21b-d9fee06b9992	admin-roadmap-backbone	agent-bootstrap-backbone	closeout-snapshot	1	45	5	\N	{"openTaskCount": 5, "analysisVersionId": "1b3e3f7f-0741-473e-9804-4e92572d8de0", "recommendationCount": 5}	2026-03-15 14:21:43.863118
11af0335-953f-4f11-b175-389fe8ac0412	admin-roadmap-backbone	agent-bootstrap-backbone	friction-task-sync	1	0	0	\N	{"threshold": 2, "createdCount": 0, "updatedCount": 0, "eligibleCount": 0}	2026-03-15 14:30:18.70829
\.


--
-- Data for Name: admin_analysis_versions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.admin_analysis_versions (id, resource_id, module, version, payload_json, item_count, trigger, created_at) FROM stdin;
1b3e3f7f-0741-473e-9804-4e92572d8de0	admin-roadmap-backbone	agent-bootstrap-backbone	1	{"project": {"title": "Admin Roadmap Backbone - Agent Bootstrap and Continuous Improvement", "status": "active", "openTasks": [{"title": "Define success metrics for reduced startup and rediscovery cost", "status": "todo", "priority": "medium", "workstreamTitle": "Governance, Safety, and Backbone Adoption"}, {"title": "Log repeated setup friction into analysis records", "status": "todo", "priority": "high", "workstreamTitle": "Friction Logging and Closed-Loop Improvement"}, {"title": "Auto-create or update roadmap tasks from repeated friction patterns", "status": "todo", "priority": "high", "workstreamTitle": "Friction Logging and Closed-Loop Improvement"}, {"title": "Generate session closeout improvements for future agent runs", "status": "todo", "priority": "medium", "workstreamTitle": "Friction Logging and Closed-Loop Improvement"}, {"title": "Define guardrails for self-amending agent behavior", "status": "todo", "priority": "critical", "workstreamTitle": "Governance, Safety, and Backbone Adoption"}], "totalTasks": 12, "completedTasks": 7}, "artifacts": {"guardrailsDocument": "docs/projects/agent-bootstrap-self-amend-guardrails.md", "durableMemoryGeneratedAt": "2026-03-15T13:35:29.450Z", "workspaceManifestGeneratedAt": "2026-03-15T14:21:43.663Z"}, "guardrails": {"headings": ["Purpose", "Allowed Automatic Writes", "Allowed Semi-Automatic Writes", "Prohibited Automatic Writes", "Read-Only Dependencies", "Promotion Rules", "Friction Logging Rules", "Session Closeout Rules", "Escalation Conditions", "Operating Principle"]}, "generatedAt": "2026-03-15T14:21:43.855Z", "knownIssues": [{"issue": "npm run check currently fails on an existing IStorage mismatch in server/storage.ts for previewAiIngestionSupersededCleanup and executeAiIngestionSupersededCleanup.", "impact": "TypeScript validation is not currently a clean signal for unrelated changes."}, {"issue": "A separate known TypeScript/iterator issue has also surfaced around matchAll iteration in server/storage.ts.", "impact": "Some checks may expose pre-existing compiler targets or iterator compatibility issues outside the current task."}], "recommendations": [{"type": "next-slice", "title": "Define success metrics for reduced startup and rediscovery cost", "rationale": "Open backbone task in Governance, Safety, and Backbone Adoption with medium priority."}, {"type": "next-slice", "title": "Log repeated setup friction into analysis records", "rationale": "Open backbone task in Friction Logging and Closed-Loop Improvement with high priority."}, {"type": "next-slice", "title": "Auto-create or update roadmap tasks from repeated friction patterns", "rationale": "Open backbone task in Friction Logging and Closed-Loop Improvement with high priority."}, {"type": "next-slice", "title": "Generate session closeout improvements for future agent runs", "rationale": "Open backbone task in Friction Logging and Closed-Loop Improvement with medium priority."}, {"type": "next-slice", "title": "Define guardrails for self-amending agent behavior", "rationale": "Open backbone task in Governance, Safety, and Backbone Adoption with critical priority."}]}	5	agent-backbone-closeout	2026-03-15 14:21:43.85968
027469b5-6e24-4ac7-adcc-186261d02afd	admin-roadmap-backbone	agent-bootstrap-backbone	2	{"module": "agent-bootstrap-backbone", "resourceId": "admin-roadmap-backbone", "generatedAt": "2026-03-15T14:30:18.497Z", "sourceArtifacts": {"guardrails": "docs/projects/agent-bootstrap-self-amend-guardrails.md", "durableMemory": "docs/agent-bootstrap/durable-memory.json", "metricsDefinition": "docs/projects/agent-bootstrap-success-metrics.md", "workspaceManifest": "docs/agent-bootstrap/workspace-manifest.json"}, "artifactCoverage": {"metricsDoc": true, "durableMemory": true, "guardrailsDoc": true, "workspaceManifest": true, "metricsSnapshotCount": 0, "closeoutSnapshotCount": 1}, "verificationReuse": {"durableVerificationPathsCaptured": 4, "verificationRelatedFrictionObservations": 1}, "frictionCaptureRate": {"distinctCategories": 1, "repeatableObservations": 1, "precomputableObservations": 1, "totalFrictionObservations": 1}, "seedRoadmapCompletion": {"totalTasks": 12, "completedTasks": 10, "remainingTasks": 2}, "startupCostReductionProxy": {"backboneArtifactRefreshes": 1, "repeatableFrictionObserved": 1, "closeoutRecommendationsGenerated": 5}, "frictionToBacklogConversion": {"syncRunCount": 0, "tasksCreatedFromFriction": 0, "tasksUpdatedFromFriction": 0}}	6	agent-backbone-metrics	2026-03-15 14:30:18.5038
5f1341b3-7190-433a-97b8-c85ab186b788	admin-roadmap-backbone	agent-bootstrap-backbone	3	{"module": "agent-bootstrap-backbone", "resourceId": "admin-roadmap-backbone", "generatedAt": "2026-03-15T14:30:47.884Z", "sourceArtifacts": {"guardrails": "docs/projects/agent-bootstrap-self-amend-guardrails.md", "durableMemory": "docs/agent-bootstrap/durable-memory.json", "metricsDefinition": "docs/projects/agent-bootstrap-success-metrics.md", "workspaceManifest": "docs/agent-bootstrap/workspace-manifest.json"}, "artifactCoverage": {"metricsDoc": true, "durableMemory": true, "guardrailsDoc": true, "workspaceManifest": true, "metricsSnapshotCount": 1, "closeoutSnapshotCount": 1}, "verificationReuse": {"durableVerificationPathsCaptured": 4, "verificationRelatedFrictionObservations": 1}, "frictionCaptureRate": {"distinctCategories": 1, "repeatableObservations": 1, "precomputableObservations": 1, "totalFrictionObservations": 1}, "seedRoadmapCompletion": {"totalTasks": 12, "completedTasks": 12, "remainingTasks": 0}, "startupCostReductionProxy": {"backboneArtifactRefreshes": 1, "repeatableFrictionObserved": 1, "closeoutRecommendationsGenerated": 5}, "frictionToBacklogConversion": {"syncRunCount": 1, "tasksCreatedFromFriction": 0, "tasksUpdatedFromFriction": 0}}	6	agent-backbone-metrics	2026-03-15 14:30:47.88776
\.


--
-- Data for Name: admin_association_scopes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.admin_association_scopes (id, admin_user_id, association_id, scope, created_at) FROM stdin;
b3646098-f802-4a60-856f-9d2627641405	ae7a1d67-d01a-4041-ac39-68e1519ee77d	628b7d4b-b052-44a5-9bcc-69784581450c	read-write	2026-03-15 15:10:07.410297
f2af7eb6-7f93-4d46-adbe-ccfb28844275	ae7a1d67-d01a-4041-ac39-68e1519ee77d	f301d073-ed84-4d73-84ce-3ef28af66f7a	admin	2026-03-14 14:48:30.305217
7adfd864-bc7b-46aa-8323-81b07f45d0a7	3121e4f5-e6c9-4660-b94c-c02879a4281e	f301d073-ed84-4d73-84ce-3ef28af66f7a	admin	2026-03-16 21:21:22.363
\.


--
-- Data for Name: admin_executive_evidence; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.admin_executive_evidence (id, executive_update_id, evidence_type, label, value, metadata_json, created_at) FROM stdin;
441e29dd-89c4-405c-b886-7c0721cbf304	28ca76e5-31b8-4b9b-8822-4ef88162ee40	note	Phase scope	Phase 1 modules implemented end-to-end in admin UI and API.	{"seeded": true}	2026-03-07 16:21:15.666403
3b0d7166-8e64-4ee6-915f-7997e0a29a4c	28ca76e5-31b8-4b9b-8822-4ef88162ee40	metric	Registry coverage	18-unit roster + owner and tenant records supported.	{"seeded": true}	2026-03-07 16:21:15.672399
03516761-847f-4b8b-9795-641637ebc4ed	5177a5cf-9b7c-4c63-a884-de4438d49d1c	release-note	Repository capabilities	Upload, tag-to-entity, and version history paths are available.	{"seeded": true}	2026-03-07 16:21:15.688073
c7ddfd91-86f9-4473-9734-53de522bf143	5177a5cf-9b7c-4c63-a884-de4438d49d1c	note	Audit context	Create/update/delete operations captured through admin audit controls.	{"seeded": true}	2026-03-07 16:21:15.692974
40fe08ac-6368-49a9-b1f0-9ecafa2d621b	f3737443-45f4-4d08-aded-fae2a85fdd14	metric	Financial modules	Fee engine, assessments, late fees, owner ledger, invoices, and utilities shipped.	{"seeded": true}	2026-03-07 16:21:15.706065
77059473-3ce2-46f9-b7f9-dae783692aec	f3737443-45f4-4d08-aded-fae2a85fdd14	note	MVP alignment	Flat-fee-first model implemented with extensibility for future allocation methods.	{"seeded": true}	2026-03-07 16:21:15.71807
8552c707-defd-41a3-9149-60aa5b2527f0	0ef74c08-7208-42d4-b301-a97e8cabbade	release-note	Expense workflows	Vendor invoices, utility tracking, and attachment linking are enabled.	{"seeded": true}	2026-03-07 16:21:15.726129
caf30d12-1e4d-4116-8432-3c475aa2c499	0ef74c08-7208-42d4-b301-a97e8cabbade	note	Operational value	Filtering and ledger clarity prioritized for admin decision-making.	{"seeded": true}	2026-03-07 16:21:15.730368
2f20e0d8-fffb-4e0e-b95f-33b66db8d68b	dfe17fed-cdd9-490e-961c-57fa615c7b43	metric	Governance modules	Meetings + compliance templates + annual tasks + dashboards shipped.	{"seeded": true}	2026-03-07 16:21:15.743594
edb78590-d92e-4c7a-81cd-b51a5f57e54e	dfe17fed-cdd9-490e-961c-57fa615c7b43	note	Risk reduction	Designed to lower missed obligations and missing-record scenarios.	{"seeded": true}	2026-03-07 16:21:15.747751
93f8e4d0-0471-4e62-9862-36dbac36cc5c	434c2106-9dbd-4aea-8acc-7205139c77b4	release-note	Ingestion pipeline	Jobs, extraction output, and review actions are available in admin.	{"seeded": true}	2026-03-07 16:21:15.774377
2047700a-cc01-47c3-ba07-90920b99cdc2	434c2106-9dbd-4aea-8acc-7205139c77b4	note	Safety posture	No autonomous write-through into production records without review.	{"seeded": true}	2026-03-07 16:21:15.786074
11921136-4366-4f9b-a77a-a8952fde907c	02f723ed-9c01-4c2f-851d-436560e6029b	metric	Expansion modules	Communications + platform controls + admin role workflows shipped.	{"seeded": true}	2026-03-07 16:21:15.796409
a9f9d92d-a7bb-4b57-afaa-44d12f989ee9	02f723ed-9c01-4c2f-851d-436560e6029b	note	Governance support	All actions remain admin-restricted and auditable.	{"seeded": true}	2026-03-07 16:21:15.801131
c74ea170-3cf7-4213-a9f3-4d92add57167	86542c54-e3d4-465b-9515-ea09adf6a8b1	release-note	Scope behavior	Global HOA selector with persistent context and scoped API retrieval.	{"seeded": true}	2026-03-07 16:21:15.818667
c687ed27-f429-4ff2-9f63-03fa893feb5c	86542c54-e3d4-465b-9515-ea09adf6a8b1	note	UX consistency	Portfolio overview remains on dashboard; operations stay association-bound.	{"seeded": true}	2026-03-07 16:21:15.840664
\.


--
-- Data for Name: admin_executive_updates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.admin_executive_updates (id, title, headline, summary, business_value, status, source_type, source_key, project_id, workstream_id, task_id, delivered_at, display_order, created_by, created_at, updated_at, problem_statement, solution_summary, features_delivered) FROM stdin;
44f087ec-8612-4507-903d-84acbd7b63cf	Phase 3 - Governance, Meetings, and Compliance Operations: Governance: Kanban/Workstream Task Visibility	Governance: Kanban/Workstream Task Visibility	Delivered in Calendar and Task Workflows. Expose governance checklist tasks via Kanban/workstream views for operational execution tracking.	Moves Phase 3 - Governance, Meetings, and Compliance Operations forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:4525606c-93d1-4a36-9356-f299149e9ecd	97747fa0-40e2-4113-b6e6-dba6e033eae4	2f98b4ba-ee22-4b73-a997-0d14a4716d9d	4525606c-93d1-4a36-9356-f299149e9ecd	2026-03-06 20:58:23.346	0	system	2026-03-07 16:16:10.267399	2026-03-09 16:02:52.323	- Delivery Need: Expose governance checklist tasks via Kanban/workstream views for operational execution tracking.	- Delivered Outcome: Governance: Kanban/Workstream Task Visibility completed in Calendar and Task Workflows.	{"Execution Item: Governance: Kanban/Workstream Task Visibility"}
b34df4dd-4424-4fc0-a21e-95a3685996b2	Phase 3 - Governance, Meetings, and Compliance Operations: Governance: Budget Meeting Support Workflow	Governance: Budget Meeting Support Workflow	Delivered in Meeting Tracker. Support budget-meeting-specific scheduling metadata and linkage to annual checklist obligations.	Moves Phase 3 - Governance, Meetings, and Compliance Operations forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:e5f2283b-079e-4550-adb9-128e3fa974e8	97747fa0-40e2-4113-b6e6-dba6e033eae4	e48312ae-b030-40c2-8c15-8d4de6aa540d	e5f2283b-079e-4550-adb9-128e3fa974e8	2026-03-06 20:58:23.329	0	system	2026-03-07 16:16:10.276879	2026-03-09 16:02:52.328	- Delivery Need: Support budget-meeting-specific scheduling metadata and linkage to annual checklist obligations.	- Delivered Outcome: Governance: Budget Meeting Support Workflow completed in Meeting Tracker.	{"Execution Item: Governance: Budget Meeting Support Workflow"}
e654c76a-f4fd-4464-b7b3-71814a9576f5	Phase 3 - Governance, Meetings, and Compliance Operations: 6.1.2 Track Task Completion	6.1.2 Track Task Completion	Delivered in Calendar and Task Workflows. Track completion state transitions for annual compliance tasks.	Moves Phase 3 - Governance, Meetings, and Compliance Operations forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:025f2027-0bce-4e08-b4d0-28ff19c51228	97747fa0-40e2-4113-b6e6-dba6e033eae4	2f98b4ba-ee22-4b73-a997-0d14a4716d9d	025f2027-0bce-4e08-b4d0-28ff19c51228	2026-03-06 20:58:23.35	0	system	2026-03-07 16:16:10.283314	2026-03-09 16:02:52.333	- Delivery Need: Track completion state transitions for annual compliance tasks.	- Delivered Outcome: 6.1.2 Track Task Completion completed in Calendar and Task Workflows.	{"Execution Item: 6.1.2 Track Task Completion"}
df1eeb4e-488e-4bfe-be68-12a81fd3fa10	Phase 3 - Governance, Meetings, and Compliance Operations: 6.1.1 Create Annual Governance Tasks	6.1.1 Create Annual Governance Tasks	Delivered in Annual Checklist and Compliance Engine. Generate annual governance checklist tasks and due dates.	Moves Phase 3 - Governance, Meetings, and Compliance Operations forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:0952f3fc-2bb1-41b5-a89f-2d8661fb2a28	97747fa0-40e2-4113-b6e6-dba6e033eae4	769aa68c-a3ab-4623-a92e-79d176cad1b3	0952f3fc-2bb1-41b5-a89f-2d8661fb2a28	2026-03-06 20:50:48.162	0	system	2026-03-07 16:16:10.294671	2026-03-09 16:02:52.343	- Delivery Need: Generate annual governance checklist tasks and due dates.	- Delivered Outcome: 6.1.1 Create Annual Governance Tasks completed in Annual Checklist and Compliance Engine.	{"Execution Item: 6.1.1 Create Annual Governance Tasks"}
434c2106-9dbd-4aea-8acc-7205139c77b4	Phase 4 AI Intake	AI-assisted document intake and review queue launched	Raw uploads and pasted content can be processed into structured candidate records with review states and human approval controls.	Cuts manual intake effort while preserving governance safety through review-first workflows.	published	manual	seed:phase4:ai-intake	\N	\N	\N	2026-03-07 10:20:00	0	system-curated-seed	2026-03-07 16:21:15.752405	2026-03-07 16:21:15.751	\N	\N	{}
94c45e75-8da9-47d5-8e0a-d37378c8faa7	Phase 3 - Governance, Meetings, and Compliance Operations: 5.1.2 Record Meeting Notes	5.1.2 Record Meeting Notes	Delivered in Notes and Minutes Repository. Capture meeting notes/minutes and attachments.	Moves Phase 3 - Governance, Meetings, and Compliance Operations forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:b7a2237b-d235-4ae5-b8c3-8d37f86fdeea	97747fa0-40e2-4113-b6e6-dba6e033eae4	4bca35a2-0673-4ff8-9975-1bdfde9c7e2d	b7a2237b-d235-4ae5-b8c3-8d37f86fdeea	2026-03-06 20:58:23.325	0	system	2026-03-07 16:16:10.193382	2026-03-09 16:02:52.3	- Delivery Need: Capture meeting notes/minutes and attachments.	- Delivered Outcome: 5.1.2 Record Meeting Notes completed in Notes and Minutes Repository.	{"Execution Item: 5.1.2 Record Meeting Notes"}
9d82ade1-112f-40ca-869d-0bfd204d8de1	Phase 4 - Document Intelligence, Intake, and Operational Scale: 4.2.1 Upload Raw Document for Parsing	4.2.1 Upload Raw Document for Parsing	Delivered in AI Document Ingestion. Support raw file upload path into AI parsing pipeline.	Moves Phase 4 - Document Intelligence, Intake, and Operational Scale forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:146f7f22-0b40-47c8-8251-3cc75348598d	b1376498-d4d1-4400-ac8b-3b5a2ce6aea0	84775f80-73cf-441d-8e88-ef41be318894	146f7f22-0b40-47c8-8251-3cc75348598d	2026-03-06 21:13:41.044	0	system	2026-03-07 16:16:10.235319	2026-03-09 16:02:52.31	- Delivery Need: Support raw file upload path into AI parsing pipeline.	- Delivered Outcome: 4.2.1 Upload Raw Document for Parsing completed in AI Document Ingestion.	{"Execution Item: 4.2.1 Upload Raw Document for Parsing"}
1f361470-f708-4aac-a6c2-13a9db63bbd7	Phase 5 - Portals, Communications, and SaaS Expansion: Platform: Future Self-Service Permission Envelope	Platform: Future Self-Service Permission Envelope	Delivered in Subscription and SaaS Admin Controls. Define permission envelope for future owner/tenant self-service roles without exposing internal admin operations.	Moves Phase 5 - Portals, Communications, and SaaS Expansion forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:c4e4f424-c225-4e56-95c6-dbd14467c76f	567fd831-d3fb-4867-8565-1609e8bea1c2	ec8ea352-58d6-4a75-9875-fa7c7c3a6d7e	c4e4f424-c225-4e56-95c6-dbd14467c76f	2026-03-06 21:20:59.766	0	system	2026-03-07 16:16:10.242621	2026-03-09 16:02:52.314	- Delivery Need: Define permission envelope for future owner/tenant self-service roles without exposing internal admin operations.	- Delivered Outcome: Platform: Future Self-Service Permission Envelope completed in Subscription and SaaS Admin Controls.	{"Execution Item: Platform: Future Self-Service Permission Envelope"}
d0194e7e-a1cd-4579-ae06-142f7edcb7e3	Phase 5 - Portals, Communications, and SaaS Expansion: 7.1.2 Send Email Notice	7.1.2 Send Email Notice	Delivered in Gmail/Email Integration. Enable outbound email notice delivery via integration layer.	Moves Phase 5 - Portals, Communications, and SaaS Expansion forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:160e0e2e-635f-4353-adb5-3e1e63e1cb4c	567fd831-d3fb-4867-8565-1609e8bea1c2	ce565bb6-6198-4524-b3a3-2de40ca482e4	160e0e2e-635f-4353-adb5-3e1e63e1cb4c	2026-03-06 21:20:59.761	0	system	2026-03-07 16:16:10.347995	2026-03-09 16:02:52.37	- Delivery Need: Enable outbound email notice delivery via integration layer.	- Delivered Outcome: 7.1.2 Send Email Notice completed in Gmail/Email Integration.	{"Execution Item: 7.1.2 Send Email Notice"}
083af496-a365-4c95-879c-dc214bbbb922	Phase 5 - Portals, Communications, and SaaS Expansion: 7.1.3 Log Communication History	7.1.3 Log Communication History	Delivered in Communications Layer. Persist communication event history for audit and support.	Moves Phase 5 - Portals, Communications, and SaaS Expansion forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:5dcd1b2f-5396-4b91-afe3-4f8b09ac1f9e	567fd831-d3fb-4867-8565-1609e8bea1c2	753bde20-ebb0-482d-a49c-d07f411a5f16	5dcd1b2f-5396-4b91-afe3-4f8b09ac1f9e	2026-03-06 21:20:59.763	0	system	2026-03-07 16:16:10.360334	2026-03-09 16:02:52.375	- Delivery Need: Persist communication event history for audit and support.	- Delivered Outcome: 7.1.3 Log Communication History completed in Communications Layer.	{"Execution Item: 7.1.3 Log Communication History"}
aa8e7875-fcb2-4e14-b87a-465455e8f0e8	Phase 1 - Foundation, Registry, and Core Admin: 1.1.1 Create Unit Record	1.1.1 Create Unit Record	Delivered in Unit Registry. Create and persist unit records with unique identifiers in the master registry.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:e5363ecd-5fbb-4b81-b494-b81295f2e4a2	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	d82033cc-3ed0-4096-96cd-cb426534f216	e5363ecd-5fbb-4b81-b494-b81295f2e4a2	2026-03-06 18:04:07.045	0	system	2026-03-07 16:16:10.401016	2026-03-09 16:02:52.384	- Delivery Need: Create and persist unit records with unique identifiers in the master registry.	- Delivered Outcome: 1.1.1 Create Unit Record completed in Unit Registry.	{"Execution Item: 1.1.1 Create Unit Record"}
72816789-d896-45f7-a9fb-10bcc56920c0	Phase 1 - Foundation, Registry, and Core Admin: 1.1.2 Edit Unit Attributes	1.1.2 Edit Unit Attributes	Delivered in Unit Registry. Support updates to structural and identifying unit attributes.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:c8e4fd88-9042-444a-99b1-ddceef7030b3	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	d82033cc-3ed0-4096-96cd-cb426534f216	c8e4fd88-9042-444a-99b1-ddceef7030b3	2026-03-06 18:08:59.341	0	system	2026-03-07 16:16:10.414948	2026-03-09 16:02:52.395	- Delivery Need: Support updates to structural and identifying unit attributes.	- Delivered Outcome: 1.1.2 Edit Unit Attributes completed in Unit Registry.	{"Execution Item: 1.1.2 Edit Unit Attributes"}
b4f769f9-ae28-4f4d-b2f5-c83384213e22	Phase 1 - Foundation, Registry, and Core Admin: 4.1.3 Maintain Document Version History	4.1.3 Maintain Document Version History	Delivered in Document Repository. Track and retain document revisions with history metadata.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:80b203af-a4f9-4430-b0e2-e5c78679c389	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	88aa305f-0fed-447d-b12c-d1352e3c6120	80b203af-a4f9-4430-b0e2-e5c78679c389	2026-03-06 18:16:34.304	0	system	2026-03-07 16:16:10.421286	2026-03-09 16:02:52.4	- Delivery Need: Track and retain document revisions with history metadata.	- Delivered Outcome: 4.1.3 Maintain Document Version History completed in Document Repository.	{"Execution Item: 4.1.3 Maintain Document Version History"}
b9274307-83a1-4e37-b449-1a16edd0686c	Phase 1 - Foundation, Registry, and Core Admin: 8.1.3 Validate Permission Changes	8.1.3 Validate Permission Changes	Delivered in Auth, Roles, and Audit Logging. Track and validate permission change events with auditability.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:328cfb8c-4e56-4376-bc17-d1dbdd9b96fd	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	0b8f0f54-dbd3-46d5-a8d3-25b321e2a06b	328cfb8c-4e56-4376-bc17-d1dbdd9b96fd	2026-03-06 18:16:34.312	0	system	2026-03-07 16:16:10.445128	2026-03-09 16:02:52.41	- Delivery Need: Track and validate permission change events with auditability.	- Delivered Outcome: 8.1.3 Validate Permission Changes completed in Auth, Roles, and Audit Logging.	{"Execution Item: 8.1.3 Validate Permission Changes"}
b4e76b78-e692-4ab9-842b-e85f3a1f33d7	Phase 3 - Governance, Meetings, and Compliance Operations: Governance: CT-Level Compliance Baseline Template	Governance: CT-Level Compliance Baseline Template	Delivered in Annual Checklist and Compliance Engine. Seed checklist template with Connecticut-priority obligations before condo-bylaw automation layers.	Moves Phase 3 - Governance, Meetings, and Compliance Operations forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:191ee0d8-2a3b-4fcc-9f24-684bdeb05901	97747fa0-40e2-4113-b6e6-dba6e033eae4	769aa68c-a3ab-4623-a92e-79d176cad1b3	191ee0d8-2a3b-4fcc-9f24-684bdeb05901	2026-03-06 20:50:48.166	0	system	2026-03-07 16:16:10.309067	2026-03-09 16:02:52.353	- Delivery Need: Seed checklist template with Connecticut-priority obligations before condo-bylaw automation layers.	- Delivered Outcome: Governance: CT-Level Compliance Baseline Template completed in Annual Checklist and Compliance Engine.	{"Execution Item: Governance: CT-Level Compliance Baseline Template"}
8276679a-b84a-4b24-85f0-e91ac1967b32	Phase 5 - Portals, Communications, and SaaS Expansion: 7.1.1 Generate Notice Template	7.1.1 Generate Notice Template	Delivered in Notice Templates. Create reusable notice templates for association communication.	Moves Phase 5 - Portals, Communications, and SaaS Expansion forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:56f44985-d726-4e5c-a951-3acdefe0df5c	567fd831-d3fb-4867-8565-1609e8bea1c2	a2f542b2-97ad-41be-86af-d6d957b3d998	56f44985-d726-4e5c-a951-3acdefe0df5c	2026-03-06 21:20:59.754	0	system	2026-03-07 16:16:10.335702	2026-03-09 16:02:52.365	- Delivery Need: Create reusable notice templates for association communication.	- Delivered Outcome: 7.1.1 Generate Notice Template completed in Notice Templates.	{"Execution Item: 7.1.1 Generate Notice Template"}
abefc7a9-c108-425e-be71-42e6bf023bf3	Phase 1 - Foundation, Registry, and Core Admin: 2.1.2 Store Board Role Metadata	2.1.2 Store Board Role Metadata	Delivered in Board Role Tracking. Store role title, dates, and association linkage metadata.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:8a3fe6ae-1be2-4caf-9ceb-02b9cc50ada4	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	9a954185-9d87-4874-a96f-adbd366616d9	8a3fe6ae-1be2-4caf-9ceb-02b9cc50ada4	2026-03-06 18:23:07.355	0	system	2026-03-07 16:16:10.505717	2026-03-09 16:02:52.434	- Delivery Need: Store role title, dates, and association linkage metadata.	- Delivered Outcome: 2.1.2 Store Board Role Metadata completed in Board Role Tracking.	{"Execution Item: 2.1.2 Store Board Role Metadata"}
d018f11b-2294-4193-8ae4-618997043415	Phase 1 - Foundation, Registry, and Core Admin: 8.1.2 Restrict Data Access	8.1.2 Restrict Data Access	Delivered in Auth, Roles, and Audit Logging. Enforce role-based restrictions for admin modules.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:9b5807b6-2847-42e8-b297-bd640b48e5d8	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	0b8f0f54-dbd3-46d5-a8d3-25b321e2a06b	9b5807b6-2847-42e8-b297-bd640b48e5d8	2026-03-06 18:23:07.364	0	system	2026-03-07 16:16:10.523443	2026-03-09 16:02:52.443	- Delivery Need: Enforce role-based restrictions for admin modules.	- Delivered Outcome: 8.1.2 Restrict Data Access completed in Auth, Roles, and Audit Logging.	{"Execution Item: 8.1.2 Restrict Data Access"}
7026d380-77bb-42b8-b4fe-07bb1c9b924e	Phase 1 - Foundation, Registry, and Core Admin: 1.3.1 Submit Tenant Information Form	1.3.1 Submit Tenant Information Form	Delivered in Occupancy Contact Tracking. Capture tenant contact and emergency details through admin workflow.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:d9333deb-0734-43c8-b112-e8c0a6c10e30	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	ee2eae57-d340-44f1-879a-f9c791a87286	d9333deb-0734-43c8-b112-e8c0a6c10e30	2026-03-06 18:23:07.367	0	system	2026-03-07 16:16:10.535149	2026-03-09 16:02:52.449	- Delivery Need: Capture tenant contact and emergency details through admin workflow.	- Delivered Outcome: 1.3.1 Submit Tenant Information Form completed in Occupancy Contact Tracking.	{"Execution Item: 1.3.1 Submit Tenant Information Form"}
bab4047d-84fc-4c41-9b8a-1761e118220b	Phase 2 - Financial Operations and Budget Control: 3.1.1 Create HOA Fee Schedule	3.1.1 Create HOA Fee Schedule	Delivered in HOA/Common Fee Engine. Define recurring HOA/common charge schedules.	Moves Phase 2 - Financial Operations and Budget Control forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:f740311f-1074-44b0-8987-e532051840d2	8bc174fd-d350-4f41-833f-fc641200ec55	2ff685f0-9625-4864-b45a-ad4c4040584c	f740311f-1074-44b0-8987-e532051840d2	2026-03-06 18:52:02.492	0	system	2026-03-07 16:16:10.581515	2026-03-09 16:02:52.458	- Delivery Need: Define recurring HOA/common charge schedules.	- Delivered Outcome: 3.1.1 Create HOA Fee Schedule completed in HOA/Common Fee Engine.	{"Execution Item: 3.1.1 Create HOA Fee Schedule"}
cd14d783-3965-4852-a43f-7d78f3978e73	Phase 2 - Financial Operations and Budget Control: 3.2.2 Track Utility Payments	3.2.2 Track Utility Payments	Delivered in Utility Payment Tracking. Track utility payment entries and payment status.	Moves Phase 2 - Financial Operations and Budget Control forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:f997e5e0-7e3c-4627-8cf4-dcd958d809e6	8bc174fd-d350-4f41-833f-fc641200ec55	4a03648a-4e20-4379-a365-11935858fc6d	f997e5e0-7e3c-4627-8cf4-dcd958d809e6	2026-03-06 19:11:07.555	0	system	2026-03-07 16:16:10.597343	2026-03-09 16:02:52.463	- Delivery Need: Track utility payment entries and payment status.	- Delivered Outcome: 3.2.2 Track Utility Payments completed in Utility Payment Tracking.	{"Execution Item: 3.2.2 Track Utility Payments"}
cde0b279-42f4-47f1-be27-55210baf976f	Phase 2 - Financial Operations and Budget Control: 3.1.3 Calculate Late Fees	3.1.3 Calculate Late Fees	Delivered in Late Fee Rules. Implement configurable late fee policy and calculation logic.	Moves Phase 2 - Financial Operations and Budget Control forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:a75a8a9f-1eaf-48a7-bb0c-46e3f9bf0e3b	8bc174fd-d350-4f41-833f-fc641200ec55	a11a1942-708c-4aa9-93f0-fd7aeeef7642	a75a8a9f-1eaf-48a7-bb0c-46e3f9bf0e3b	2026-03-06 18:54:57.819	0	system	2026-03-07 16:16:10.604871	2026-03-09 16:02:52.468	- Delivery Need: Implement configurable late fee policy and calculation logic.	- Delivered Outcome: 3.1.3 Calculate Late Fees completed in Late Fee Rules.	{"Execution Item: 3.1.3 Calculate Late Fees"}
626b05c9-bd0f-4ba6-9689-4e434a8776c4	Phase 1 - Foundation, Registry, and Core Admin: 1.3.3 Track Occupancy History	1.3.3 Track Occupancy History	Delivered in Occupancy Contact Tracking. Track start/end occupancy changes over time for auditability.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:f7d4af4a-2eba-4f8c-9816-f5b17234cafd	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	ee2eae57-d340-44f1-879a-f9c791a87286	f7d4af4a-2eba-4f8c-9816-f5b17234cafd	2026-03-06 18:23:07.348	0	system	2026-03-07 16:16:10.491166	2026-03-09 16:02:52.424	- Delivery Need: Track start/end occupancy changes over time for auditability.	- Delivered Outcome: 1.3.3 Track Occupancy History completed in Occupancy Contact Tracking.	{"Execution Item: 1.3.3 Track Occupancy History"}
51529670-ea67-426e-ab5a-b361d30435bf	Phase 1 - Foundation, Registry, and Core Admin: 2.1.1 Assign Board Member Role	2.1.1 Assign Board Member Role	Delivered in Board Role Tracking. Assign officer and board roles to people records.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:79d295f5-804a-4a06-b03c-dc017e8f12e2	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	9a954185-9d87-4874-a96f-adbd366616d9	79d295f5-804a-4a06-b03c-dc017e8f12e2	2026-03-06 18:23:07.352	0	system	2026-03-07 16:16:10.498987	2026-03-09 16:02:52.429	- Delivery Need: Assign officer and board roles to people records.	- Delivered Outcome: 2.1.1 Assign Board Member Role completed in Board Role Tracking.	{"Execution Item: 2.1.1 Assign Board Member Role"}
c2e47475-10fa-4db9-a3d5-b3fc13665ff8	Phase 1 - Foundation, Registry, and Core Admin: 1.2.1 Create Owner Profile	1.2.1 Create Owner Profile	Delivered in Person Registry. Create owner profiles to support ownership relationships.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:2a0ccb83-9303-4fde-96a2-7c9c4087e5ed	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	bb9090ec-ea74-4b89-b081-cbef52a0c8c9	2a0ccb83-9303-4fde-96a2-7c9c4087e5ed	2026-03-06 18:23:07.371	0	system	2026-03-07 16:16:10.658975	2026-03-09 16:02:52.489	- Delivery Need: Create owner profiles to support ownership relationships.	- Delivered Outcome: 1.2.1 Create Owner Profile completed in Person Registry.	{"Execution Item: 1.2.1 Create Owner Profile"}
1eaeb856-717c-47eb-881e-feaf7794e9cc	Phase 1 - Foundation, Registry, and Core Admin: Foundation: Load Initial 18-Unit Roster with Addresses	Foundation: Load Initial 18-Unit Roster with Addresses	Delivered in Unit Registry. Load and verify the initial 18-unit roster and addresses for New Haven deployment.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:6bac3acb-6ce5-4a31-abd1-2e82c14c8de9	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	d82033cc-3ed0-4096-96cd-cb426534f216	6bac3acb-6ce5-4a31-abd1-2e82c14c8de9	2026-03-06 18:23:07.376	0	system	2026-03-07 16:16:10.687464	2026-03-09 16:02:52.498	- Delivery Need: Load and verify the initial 18-unit roster and addresses for New Haven deployment.	- Delivered Outcome: Foundation: Load Initial 18-Unit Roster with Addresses completed in Unit Registry.	{"Execution Item: Foundation: Load Initial 18-Unit Roster with Addresses"}
3c378c8e-bfbe-4db0-82fd-691b14dd5fad	Phase 1 - Foundation, Registry, and Core Admin: Foundation: Admin Dashboard Shell for Registry Modules	Foundation: Admin Dashboard Shell for Registry Modules	Delivered in Basic Dashboard. Provide left-nav admin dashboard shell and quick metrics for registry and governance modules.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:931ba38a-6243-4ced-99f4-04061a5d1bbc	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	d73e3106-2d55-4aff-ae9e-3b9f9a6a6646	931ba38a-6243-4ced-99f4-04061a5d1bbc	2026-03-06 18:23:07.38	0	system	2026-03-07 16:16:10.695921	2026-03-09 16:02:52.503	- Delivery Need: Provide left-nav admin dashboard shell and quick metrics for registry and governance modules.	- Delivered Outcome: Foundation: Admin Dashboard Shell for Registry Modules completed in Basic Dashboard.	{"Execution Item: Foundation: Admin Dashboard Shell for Registry Modules"}
a453a72c-60cc-435f-a979-a2a51e6f495d	Phase 1 - Foundation, Registry, and Core Admin: Remediation: Add Document Version Management UI Workflow	Remediation: Add Document Version Management UI Workflow	Delivered in Document Repository. Expose version history list and upload-new-version flow in admin documents page including replacement context.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:04b997d4-9af4-4381-a27d-8c1619251339	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	88aa305f-0fed-447d-b12c-d1352e3c6120	04b997d4-9af4-4381-a27d-8c1619251339	2026-03-06 18:43:02.838	0	system	2026-03-07 16:16:10.701811	2026-03-09 16:02:52.507	- Delivery Need: Expose version history list and upload-new-version flow in admin documents page including replacement context.	- Delivered Outcome: Remediation: Add Document Version Management UI Workflow completed in Document Repository.	{"Execution Item: Remediation: Add Document Version Management UI Workflow"}
69e9a698-156a-4fc2-85a5-c5aac79d3afb	Phase 1 - Foundation, Registry, and Core Admin: Remediation: Add Phase 1 Verification Test Suite	Remediation: Add Phase 1 Verification Test Suite	Delivered in Basic Dashboard. Create integration checks for RBAC guards, unit history actor logging, document tags/versions, and permission-change validations.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:0837f8e6-3e0f-4673-a639-82a88833083c	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	d73e3106-2d55-4aff-ae9e-3b9f9a6a6646	0837f8e6-3e0f-4673-a639-82a88833083c	2026-03-06 18:44:24.928	0	system	2026-03-07 16:16:10.712093	2026-03-09 16:02:52.519	- Delivery Need: Create integration checks for RBAC guards, unit history actor logging, document tags/versions, and permission-change validations.	- Delivered Outcome: Remediation: Add Phase 1 Verification Test Suite completed in Basic Dashboard.	{"Execution Item: Remediation: Add Phase 1 Verification Test Suite"}
355fedab-d3bf-43f7-a6ff-0e9274450503	Phase 2 - Financial Operations and Budget Control: Finance Foundation: Configure Financial Accounts and Categories	Finance Foundation: Configure Financial Accounts and Categories	Delivered in Budget Planning and Ratification. Create baseline financial account/category configuration for invoice, utility, and budget workflows.	Moves Phase 2 - Financial Operations and Budget Control forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:54c20d5d-47d9-4c3d-8b6d-08255933ffd0	8bc174fd-d350-4f41-833f-fc641200ec55	ab01d8e7-1871-43d1-b0e1-98779e264701	54c20d5d-47d9-4c3d-8b6d-08255933ffd0	2026-03-06 19:11:07.57	0	system	2026-03-07 16:16:10.741405	2026-03-09 16:02:52.534	- Delivery Need: Create baseline financial account/category configuration for invoice, utility, and budget workflows.	- Delivered Outcome: Finance Foundation: Configure Financial Accounts and Categories completed in Budget Planning and Ratification.	{"Execution Item: Finance Foundation: Configure Financial Accounts and Categories"}
f59916df-a26c-4055-a2d9-b3b4c87e94e5	Phase 1 - Foundation, Registry, and Core Admin completed	Phase 1 - Foundation, Registry, and Core Admin reached 100%	Project completed with 29/29 roadmap tasks delivered (100%).	Creates a clean executive proof point for customer-facing progress and product maturity.	published	roadmap-project	slide:roadmap-project:cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	\N	\N	2026-03-06 18:44:24.979	0	system	2026-03-07 16:16:10.787955	2026-03-07 18:37:11.509	- Program Goal: Complete Phase 1 - Foundation, Registry, and Core Admin with clear execution tracking.\n- Delivery Requirement: Close all planned roadmap tasks for this phase.	- Execution Result: Phase 1 - Foundation, Registry, and Core Admin is now complete.\n- Delivery Proof: 29 of 29 tasks are marked done (100%).	{"Delivered Item: 1.2.2 Link Owner to Unit","Delivered Item: 2.1.3 Track Board Service History","Delivered Item: 4.1.2 Tag Document to Entity","Delivered Item: 1.1.1 Create Unit Record","Delivered Item: 1.1.3 Track Unit Lifecycle History","Delivered Item: 1.1.2 Edit Unit Attributes","Delivered Item: 4.1.3 Maintain Document Version History","Delivered Item: 8.1.1 Assign User Role"}
ed2d313f-8c65-4f52-a180-75c3542398ba	Gap Closure M2 - Budget Domain and Variance Controls: Build budget management screens	Build budget management screens	Delivered in Budget UX and Reporting. Add budget page for version timeline, line items, and ratification actions.	Moves Gap Closure M2 - Budget Domain and Variance Controls forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:32b169ec-afb0-40fd-9f51-a48fcc5fe7da	fffb518f-1d5f-4ed1-8a3d-8eb036a1fde1	0d4b4801-1f8d-44ef-aa47-ad1c936d9dbc	32b169ec-afb0-40fd-9f51-a48fcc5fe7da	2026-03-07 17:56:23.609	0	system	2026-03-07 18:15:44.767397	2026-03-09 16:02:52.614	- Delivery Need: Add budget page for version timeline, line items, and ratification actions.	- Delivered Outcome: Build budget management screens completed in Budget UX and Reporting.	{"Execution Item: Build budget management screens"}
c4e7add9-392e-4b84-b4d0-5fd9486c0814	Phase 1 - Foundation, Registry, and Core Admin: Remediation: Add Document Tagging UI Workflow	Remediation: Add Document Tagging UI Workflow	Delivered in Document Repository. Expose document tag create/list interactions in admin documents page using document tag APIs.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:d2615072-3d2c-4f0f-a121-54e6ba6c8df0	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	88aa305f-0fed-447d-b12c-d1352e3c6120	d2615072-3d2c-4f0f-a121-54e6ba6c8df0	2026-03-06 18:43:02.834	0	system	2026-03-07 16:16:10.770328	2026-03-09 16:02:52.55	- Delivery Need: Expose document tag create/list interactions in admin documents page using document tag APIs.	- Delivered Outcome: Remediation: Add Document Tagging UI Workflow completed in Document Repository.	{"Execution Item: Remediation: Add Document Tagging UI Workflow"}
8b1f838d-711f-4cc6-a165-0769fa3eee82	Phase 1 - Foundation, Registry, and Core Admin: Remediation: Remove Auto-Escalation Admin Bootstrap Path	Remediation: Remove Auto-Escalation Admin Bootstrap Path	Delivered in Auth, Roles, and Audit Logging. Replace auto-creation of platform-admin from request headers with explicit controlled bootstrap and fail-closed behavior.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:bfe4e6c8-c475-4179-ad29-9aa8145d1e8e	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	0b8f0f54-dbd3-46d5-a8d3-25b321e2a06b	bfe4e6c8-c475-4179-ad29-9aa8145d1e8e	2026-03-06 18:43:02.77	0	system	2026-03-07 16:16:10.756976	2026-03-09 16:02:52.542	- Delivery Need: Replace auto-creation of platform-admin from request headers with explicit controlled bootstrap and fail-closed behavior.	- Delivered Outcome: Remediation: Remove Auto-Escalation Admin Bootstrap Path completed in Auth, Roles, and Audit Logging.	{"Execution Item: Remediation: Remove Auto-Escalation Admin Bootstrap Path"}
28ca76e5-31b8-4b9b-8822-4ef88162ee40	Phase 1 Foundation Delivery	Core registry and admin foundation are live	Authentication, roles, audit trail, association setup, unit/person/ownership/occupancy records, board roles, and document repository workflows are now operational.	Delivers a reliable system of record for day-to-day association operations and governance administration.	published	manual	seed:phase1:foundation-live	\N	\N	\N	2026-03-07 10:00:00	0	system-curated-seed	2026-03-07 16:21:15.653001	2026-03-07 16:21:15.65	\N	\N	{}
5177a5cf-9b7c-4c63-a884-de4438d49d1c	Document + Audit Readiness	Document storage with versioning and tagging shipped	Admins can upload key governing and operational documents, attach contextual tags, and preserve document lineage through version history.	Improves defensibility and retrieval speed for board operations, legal requests, and policy tracking.	published	manual	seed:phase1:documents-audit	\N	\N	\N	2026-03-07 10:05:00	0	system-curated-seed	2026-03-07 16:21:15.683055	2026-03-07 16:21:15.682	\N	\N	{}
f3737443-45f4-4d08-aded-fae2a85fdd14	Phase 2 Financial Operations	Dues, assessments, late fees, and ledgers are operational	Fee schedules, assessment structures, late-fee rule processing, payment posting, and owner ledger visibility were delivered with admin workflows.	Enables reliable receivables tracking and delinquency visibility without requiring external accounting integrations.	published	manual	seed:phase2:financial-core	\N	\N	\N	2026-03-07 10:10:00	0	system-curated-seed	2026-03-07 16:21:15.701291	2026-03-07 16:21:15.7	\N	\N	{}
0ef74c08-7208-42d4-b301-a97e8cabbade	Budget + Expense Controls	Invoice, utility, and budget-control foundation delivered	Expense and invoice recording, utility payment tracking, categorization, and attachment workflows are now in place for board-level financial review.	Creates audit-friendly expense management and improves visibility into operating spend and budget discipline.	published	manual	seed:phase2:budget-expense	\N	\N	\N	2026-03-07 10:12:00	0	system-curated-seed	2026-03-07 16:21:15.721963	2026-03-07 16:21:15.721	\N	\N	{}
dfe17fed-cdd9-490e-961c-57fa615c7b43	Phase 3 Governance Operations	Meetings, decisions, and compliance tasking are centralized	Meeting records, note/minute capture, annual checklist generation, task tracking, and governance dashboard visibility were delivered.	Reduces governance risk by making obligations, deadlines, and board actions visible in one operational system.	published	manual	seed:phase3:governance	\N	\N	\N	2026-03-07 10:15:00	0	system-curated-seed	2026-03-07 16:21:15.73416	2026-03-07 16:21:15.733	\N	\N	{}
02f723ed-9c01-4c2f-851d-436560e6029b	Phase 5 Expansion Layer	Communications and platform controls are production-ready	Notice templates, outbound send logging, communication history, permission envelopes, and admin-association scope controls were delivered.	Supports controlled external-facing growth while maintaining clear authorization and communication traceability.	published	manual	seed:phase5:expansion	\N	\N	\N	2026-03-07 10:25:00	0	system-curated-seed	2026-03-07 16:21:15.79188	2026-03-07 16:21:15.791	\N	\N	{}
86542c54-e3d4-465b-9515-ea09adf6a8b1	Single HOA Context UX	Association-scoped operating context is now enforced	After selecting an HOA, non-overview modules automatically scope data to that association while dashboard retains portfolio-wide visibility.	Improves operator focus and reduces cross-association confusion in day-to-day workflows.	published	manual	seed:platform:hoa-context	\N	\N	\N	2026-03-07 10:30:00	0	system-curated-seed	2026-03-07 16:21:15.812912	2026-03-07 16:21:15.812	\N	\N	{}
25b1ec40-0c6d-4790-b326-88dd16daa979	Gap Closure M1 - Audit Logging and Delete Controls: Add delete handlers for Phase 1 registries	Add delete handlers for Phase 1 registries	Delivered in Delete API and Safeguards. Implement delete routes/services for associations, units, people, ownership, occupancy, board roles, and documents.	Moves Gap Closure M1 - Audit Logging and Delete Controls forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:ca304813-a7aa-4fca-accf-2c711fe6ef68	d869e3c4-d366-44f9-83e6-b6da45e24b80	8d4444eb-d064-4d14-8d78-907ce38c5d46	ca304813-a7aa-4fca-accf-2c711fe6ef68	2026-03-07 17:49:58.593	0	system	2026-03-07 18:15:44.804294	2026-03-09 16:02:52.658	- Delivery Need: Implement delete routes/services for associations, units, people, ownership, occupancy, board roles, and documents.	- Delivered Outcome: Add delete handlers for Phase 1 registries completed in Delete API and Safeguards.	{"Execution Item: Add delete handlers for Phase 1 registries"}
38941b32-1445-4be2-8ba0-fb730ce934c9	Gap Closure M5 - Owner Portal and SaaS Tenancy: Implement contact update workflow	Implement contact update workflow	Delivered in Owner Portal UX. Allow owner-managed contact updates with moderation/audit trail.	Moves Gap Closure M5 - Owner Portal and SaaS Tenancy forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:b4ae27ee-79bc-42a0-a772-4e880f818eb8	bdcc5149-54c7-4b58-9581-e98ffaf685cc	f4b26d41-c855-4e03-8b26-7592c2c6379c	b4ae27ee-79bc-42a0-a772-4e880f818eb8	2026-03-07 18:23:12.773	0	system	2026-03-07 18:30:58.719976	2026-03-09 16:02:52.702	- Delivery Need: Allow owner-managed contact updates with moderation/audit trail.	- Delivered Outcome: Implement contact update workflow completed in Owner Portal UX.	{"Execution Item: Implement contact update workflow"}
df6e947a-bd11-4a26-91c7-f5a1c46df740	Gap Closure M5 - Owner Portal and SaaS Tenancy: Build owner portal routes and layout	Build owner portal routes and layout	Delivered in Owner Portal UX. Add owner-specific navigation and authenticated portal pages.	Moves Gap Closure M5 - Owner Portal and SaaS Tenancy forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:cb5b6edd-5e40-4bf0-9b16-c0cccaf455f9	bdcc5149-54c7-4b58-9581-e98ffaf685cc	f4b26d41-c855-4e03-8b26-7592c2c6379c	cb5b6edd-5e40-4bf0-9b16-c0cccaf455f9	2026-03-07 18:23:12.773	0	system	2026-03-07 18:30:58.714096	2026-03-09 16:02:52.697	- Delivery Need: Add owner-specific navigation and authenticated portal pages.	- Delivered Outcome: Build owner portal routes and layout completed in Owner Portal UX.	{"Execution Item: Build owner portal routes and layout"}
dc0e791d-8911-4ea1-a1a9-0bcc0f00b942	Executive Highlights & Defend Logs: Add admin-restricted executive API contracts	Add admin-restricted executive API contracts	Delivered in Data Model & API. Implement list/create/update endpoints for highlights and evidence logs.	Moves Executive Highlights & Defend Logs forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:8be6f431-e67b-4af5-b063-6ca475f095c4	9efff677-7938-4f3f-8580-2bff3e3765c2	a239134c-4744-40dc-8e15-5fc57af2e90f	8be6f431-e67b-4af5-b063-6ca475f095c4	2026-03-07 16:16:30.598	0	system	2026-03-07 16:41:41.386617	2026-03-09 16:02:52.56	- Delivery Need: Implement list/create/update endpoints for highlights and evidence logs.	- Delivered Outcome: Add admin-restricted executive API contracts completed in Data Model & API.	{"Execution Item: Add admin-restricted executive API contracts"}
853a316c-eecf-43e2-a049-e73d561a2bea	Gap Closure M5 - Owner Portal and SaaS Tenancy: Create portal access schema	Create portal access schema	Delivered in Portal and Membership Model. Add PortalAccess and AssociationMembership entities with status and role constraints.	Moves Gap Closure M5 - Owner Portal and SaaS Tenancy forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:6c8d749a-e49f-4965-846e-0f76b6881c6a	bdcc5149-54c7-4b58-9581-e98ffaf685cc	60cec03b-5b57-42d6-a2ac-767612f7cfa6	6c8d749a-e49f-4965-846e-0f76b6881c6a	2026-03-07 18:23:12.773	0	system	2026-03-07 18:30:58.645734	2026-03-09 16:02:52.644	- Delivery Need: Add PortalAccess and AssociationMembership entities with status and role constraints.	- Delivered Outcome: Create portal access schema completed in Portal and Membership Model.	{"Execution Item: Create portal access schema"}
7ad2f36e-05a3-4bef-a1d1-edee65051a52	Phase 2 - Financial Operations and Budget Control: 3.2.3 Store Expense Attachments	3.2.3 Store Expense Attachments	Delivered in Expense and Invoice Tracking. Attach and retain invoice/expense supporting files.	Moves Phase 2 - Financial Operations and Budget Control forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:17de101b-3a6e-4191-a674-ed9fabe993d3	8bc174fd-d350-4f41-833f-fc641200ec55	68245579-abd9-419d-813b-169a57a542f7	17de101b-3a6e-4191-a674-ed9fabe993d3	2026-03-06 19:11:07.56	0	system	2026-03-07 16:16:10.637173	2026-03-09 16:02:52.477	- Delivery Need: Attach and retain invoice/expense supporting files.	- Delivered Outcome: 3.2.3 Store Expense Attachments completed in Expense and Invoice Tracking.	{"Execution Item: 3.2.3 Store Expense Attachments"}
124f8d6a-1198-48eb-bd2b-d5297524ecd6	Gap Closure M5 - Owner Portal and SaaS Tenancy: Add cross-association isolation tests	Add cross-association isolation tests	Delivered in SaaS Tenancy and Messaging. Verify hard tenant boundaries for portal, communications, and admin surfaces.	Moves Gap Closure M5 - Owner Portal and SaaS Tenancy forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:60091821-00a1-41b4-827a-b954aeacffd4	bdcc5149-54c7-4b58-9581-e98ffaf685cc	f524059e-ad96-4080-8f1f-2e19f071789d	60091821-00a1-41b4-827a-b954aeacffd4	2026-03-07 18:23:12.773	0	system	2026-03-07 18:30:58.731869	2026-03-09 16:02:52.712	- Delivery Need: Verify hard tenant boundaries for portal, communications, and admin surfaces.	- Delivered Outcome: Add cross-association isolation tests completed in SaaS Tenancy and Messaging.	{"Execution Item: Add cross-association isolation tests"}
a036562c-7088-4f54-a695-3d2aa989d398	Phase 1 - Foundation, Registry, and Core Admin: 1.2.2 Link Owner to Unit	1.2.2 Link Owner to Unit	Delivered in Ownership History. Persist ownership links between people and units.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:6db6297a-2ef5-458a-9e30-ef31c41fa4eb	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	bd60a4ad-56b6-4f35-af7f-de0d57c1904f	6db6297a-2ef5-458a-9e30-ef31c41fa4eb	2026-03-06 18:23:07.195	0	system	2026-03-07 16:16:10.175616	2026-03-09 16:02:52.289	- Delivery Need: Persist ownership links between people and units.	- Delivered Outcome: 1.2.2 Link Owner to Unit completed in Ownership History.	{"Execution Item: 1.2.2 Link Owner to Unit"}
88b88eae-ab20-4cba-acab-183f9a52fc24	Phase 1 - Foundation, Registry, and Core Admin: 1.1.3 Track Unit Lifecycle History	1.1.3 Track Unit Lifecycle History	Delivered in Unit Registry. Capture historical change logs for unit configuration and lifecycle events.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:006a4f17-98a1-4ed4-8dfc-e596a3243707	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	d82033cc-3ed0-4096-96cd-cb426534f216	006a4f17-98a1-4ed4-8dfc-e596a3243707	2026-03-06 18:16:34.291	0	system	2026-03-07 16:16:10.409192	2026-03-09 16:02:52.39	- Delivery Need: Capture historical change logs for unit configuration and lifecycle events.	- Delivered Outcome: 1.1.3 Track Unit Lifecycle History completed in Unit Registry.	{"Execution Item: 1.1.3 Track Unit Lifecycle History"}
c24b43bb-a648-46ec-ba53-7b29d0d3a1bb	Phase 3 - Governance, Meetings, and Compliance Operations: 5.1.1 Schedule Meeting Record	5.1.1 Schedule Meeting Record	Delivered in Meeting Tracker. Create and manage meeting records with date/type/status.	Moves Phase 3 - Governance, Meetings, and Compliance Operations forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:262d5811-a660-47ba-aebc-26a76e8b20b9	97747fa0-40e2-4113-b6e6-dba6e033eae4	e48312ae-b030-40c2-8c15-8d4de6aa540d	262d5811-a660-47ba-aebc-26a76e8b20b9	2026-03-06 20:50:48.156	0	system	2026-03-07 16:16:10.185397	2026-03-09 16:02:52.295	- Delivery Need: Create and manage meeting records with date/type/status.	- Delivered Outcome: 5.1.1 Schedule Meeting Record completed in Meeting Tracker.	{"Execution Item: 5.1.1 Schedule Meeting Record"}
dda2e26d-37c2-4b41-8711-c03f8695d044	Phase 1 - Foundation, Registry, and Core Admin: 1.2.3 Manage Multiple Owners	1.2.3 Manage Multiple Owners	Delivered in Ownership History. Support joint ownership per unit and owner-to-multiple-unit mapping.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:6bd69e57-bc03-4f58-9552-91d05f722db0	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	bd60a4ad-56b6-4f35-af7f-de0d57c1904f	6bd69e57-bc03-4f58-9552-91d05f722db0	2026-03-06 18:23:07.342	0	system	2026-03-07 16:16:10.451025	2026-03-09 16:02:52.415	- Delivery Need: Support joint ownership per unit and owner-to-multiple-unit mapping.	- Delivered Outcome: 1.2.3 Manage Multiple Owners completed in Ownership History.	{"Execution Item: 1.2.3 Manage Multiple Owners"}
1168673c-5f6d-4f8e-946f-6028f70ad41c	Gap Closure M5 - Owner Portal and SaaS Tenancy: Add TenantConfig and EmailThread entities	Add TenantConfig and EmailThread entities	Delivered in SaaS Tenancy and Messaging. Model per-association product settings and threaded communication artifacts.	Moves Gap Closure M5 - Owner Portal and SaaS Tenancy forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:0bad30d6-f69c-4541-9ea5-546730777492	bdcc5149-54c7-4b58-9581-e98ffaf685cc	f524059e-ad96-4080-8f1f-2e19f071789d	0bad30d6-f69c-4541-9ea5-546730777492	2026-03-07 18:23:12.773	0	system	2026-03-07 18:30:58.725408	2026-03-09 16:02:52.708	- Delivery Need: Model per-association product settings and threaded communication artifacts.	- Delivered Outcome: Add TenantConfig and EmailThread entities completed in SaaS Tenancy and Messaging.	{"Execution Item: Add TenantConfig and EmailThread entities"}
37dcce7f-fc04-4ea6-b8df-20b4656cd046	Executive Highlights & Defend Logs: Implement roadmap-to-executive sync job	Implement roadmap-to-executive sync job	Delivered in Roadmap Sync Automation. Create a sync path that captures completed roadmap items and generates executive summary cards.	Moves Executive Highlights & Defend Logs forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:590918bd-d01f-48c2-bb66-1145ef5b0d49	9efff677-7938-4f3f-8580-2bff3e3765c2	2b363c41-cf1c-4870-b144-d9d9508e18fa	590918bd-d01f-48c2-bb66-1145ef5b0d49	2026-03-07 16:16:30.598	0	system	2026-03-07 16:41:41.402933	2026-03-09 16:02:52.573	- Delivery Need: Create a sync path that captures completed roadmap items and generates executive summary cards.	- Delivered Outcome: Implement roadmap-to-executive sync job completed in Roadmap Sync Automation.	{"Execution Item: Implement roadmap-to-executive sync job"}
26825f30-4b3d-44f8-856c-e3a3ff447926	Executive Highlights & Defend Logs: Deduplicate sync updates by source task linkage	Deduplicate sync updates by source task linkage	Delivered in Roadmap Sync Automation. Ensure repeated sync operations do not create duplicate executive updates.	Moves Executive Highlights & Defend Logs forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:d195a1ab-0af2-46f5-b66f-e810e23a0530	9efff677-7938-4f3f-8580-2bff3e3765c2	2b363c41-cf1c-4870-b144-d9d9508e18fa	d195a1ab-0af2-46f5-b66f-e810e23a0530	2026-03-07 16:16:30.598	0	system	2026-03-07 16:41:41.407469	2026-03-09 16:02:52.578	- Delivery Need: Ensure repeated sync operations do not create duplicate executive updates.	- Delivered Outcome: Deduplicate sync updates by source task linkage completed in Roadmap Sync Automation.	{"Execution Item: Deduplicate sync updates by source task linkage"}
02c21360-d661-40c9-a55a-dda42ebfc32c	Executive Highlights & Defend Logs: Add verification script for executive module	Add verification script for executive module	Delivered in Verification & Launch. Validate API behavior, sync generation, and evidence linkage.	Moves Executive Highlights & Defend Logs forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:fccb3be1-1656-4474-b29b-b46304b53152	9efff677-7938-4f3f-8580-2bff3e3765c2	ba6bf2dc-d369-451c-8ef1-758754ab9e1b	fccb3be1-1656-4474-b29b-b46304b53152	2026-03-07 16:16:30.598	0	system	2026-03-07 16:41:41.41253	2026-03-09 16:02:52.583	- Delivery Need: Validate API behavior, sync generation, and evidence linkage.	- Delivered Outcome: Add verification script for executive module completed in Verification & Launch.	{"Execution Item: Add verification script for executive module"}
109f558d-92cd-43d8-87b1-a8beae0a379b	Phase 1 - Foundation, Registry, and Core Admin: 2.1.3 Track Board Service History	2.1.3 Track Board Service History	Delivered in Board Role Tracking. Preserve board service timeline history for governance records.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:18dd6574-e9ba-4e39-922c-41ffc6266284	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	9a954185-9d87-4874-a96f-adbd366616d9	18dd6574-e9ba-4e39-922c-41ffc6266284	2026-03-06 18:23:07.336	0	system	2026-03-07 16:16:10.256353	2026-03-09 16:02:52.319	- Delivery Need: Preserve board service timeline history for governance records.	- Delivered Outcome: 2.1.3 Track Board Service History completed in Board Role Tracking.	{"Execution Item: 2.1.3 Track Board Service History"}
dde2f7e9-6256-4cb6-a5ca-f83646a7b010	Executive Highlights & Defend Logs completed	Executive Highlights & Defend Logs reached 100%	Project completed with 8/8 roadmap tasks delivered (100%).	Creates a clean executive proof point for customer-facing progress and product maturity.	published	roadmap-project	slide:roadmap-project:9efff677-7938-4f3f-8580-2bff3e3765c2	9efff677-7938-4f3f-8580-2bff3e3765c2	\N	\N	2026-03-07 16:16:30.598	0	system	2026-03-07 16:41:41.421921	2026-03-07 18:37:11.488	- Program Goal: Complete Executive Highlights & Defend Logs with clear execution tracking.\n- Delivery Requirement: Close all planned roadmap tasks for this phase.	- Execution Result: Executive Highlights & Defend Logs is now complete.\n- Delivery Proof: 8 of 8 tasks are marked done (100%).	{"Delivered Item: Create executive updates and evidence tables","Delivered Item: Add admin-restricted executive API contracts","Delivered Item: Build Executive page with Highlights and Defend tabs","Delivered Item: Enforce concise executive copy standards","Delivered Item: Implement roadmap-to-executive sync job","Delivered Item: Deduplicate sync updates by source task linkage","Delivered Item: Add verification script for executive module","Delivered Item: Validate end-to-end admin workflow"}
a12475ca-d0d1-450c-9676-d1763830edfc	Phase 3 - Governance, Meetings, and Compliance Operations: 6.1.3 Display Compliance Dashboard	6.1.3 Display Compliance Dashboard	Delivered in Governance Dashboard. Provide governance dashboard with deadlines, open tasks, and completion.	Moves Phase 3 - Governance, Meetings, and Compliance Operations forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:6de9a9ad-1de8-4019-b0e6-0ff9d3ef6877	97747fa0-40e2-4113-b6e6-dba6e033eae4	977deeb0-def2-4626-bbd6-87aa1af7c651	6de9a9ad-1de8-4019-b0e6-0ff9d3ef6877	2026-03-06 20:58:23.333	0	system	2026-03-07 16:16:10.288713	2026-03-09 16:02:52.339	- Delivery Need: Provide governance dashboard with deadlines, open tasks, and completion.	- Delivered Outcome: 6.1.3 Display Compliance Dashboard completed in Governance Dashboard.	{"Execution Item: 6.1.3 Display Compliance Dashboard"}
bfa54a6e-c4c4-4ddc-bb40-599e147d35eb	Executive Highlights & Defend Logs: Build Executive page with Highlights and Defend tabs	Build Executive page with Highlights and Defend tabs	Delivered in Executive UI. Create a two-tab admin module for customer-facing highlights and proof-oriented evidence entries.	Moves Executive Highlights & Defend Logs forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:adb02e1d-9059-4832-9d13-e2b0a47cec6c	9efff677-7938-4f3f-8580-2bff3e3765c2	7dfc1759-c392-4561-9da4-2defa0b8106f	adb02e1d-9059-4832-9d13-e2b0a47cec6c	2026-03-07 16:16:30.598	0	system	2026-03-07 16:41:41.392236	2026-03-09 16:02:52.565	- Delivery Need: Create a two-tab admin module for customer-facing highlights and proof-oriented evidence entries.	- Delivered Outcome: Build Executive page with Highlights and Defend tabs completed in Executive UI.	{"Execution Item: Build Executive page with Highlights and Defend tabs"}
94e6af7c-abda-437e-aae0-ce47debd2d2a	Phase 1 - Foundation, Registry, and Core Admin: 8.1.1 Assign User Role	8.1.1 Assign User Role	Delivered in Auth, Roles, and Audit Logging. Role assignment foundation for platform access control.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:05b231c8-17e0-4cf0-81aa-b53d47ebf9f2	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	0b8f0f54-dbd3-46d5-a8d3-25b321e2a06b	05b231c8-17e0-4cf0-81aa-b53d47ebf9f2	2026-03-06 18:16:34.308	0	system	2026-03-07 16:16:10.43378	2026-03-09 16:02:52.405	- Delivery Need: Role assignment foundation for platform access control.	- Delivered Outcome: 8.1.1 Assign User Role completed in Auth, Roles, and Audit Logging.	{"Execution Item: 8.1.1 Assign User Role"}
f334c62b-7b82-45bc-b9e0-0f3ddd762890	Phase 2 - Financial Operations and Budget Control: 3.1.2 Create Special Assessment	3.1.2 Create Special Assessment	Delivered in Assessment Engine. Model and issue special assessments including installments.	Moves Phase 2 - Financial Operations and Budget Control forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:f3aa2e43-74d9-4c04-8d64-65cf10f157d4	8bc174fd-d350-4f41-833f-fc641200ec55	de2d1957-77f3-4589-90d2-8f183abd78e9	f3aa2e43-74d9-4c04-8d64-65cf10f157d4	2026-03-06 18:52:02.56	0	system	2026-03-07 16:16:10.560011	2026-03-09 16:02:52.454	- Delivery Need: Model and issue special assessments including installments.	- Delivered Outcome: 3.1.2 Create Special Assessment completed in Assessment Engine.	{"Execution Item: 3.1.2 Create Special Assessment"}
61aeeb10-b80d-4a1d-b5ce-b1eab3758907	Phase 2 - Financial Operations and Budget Control: 3.2.1 Record Vendor Invoice	3.2.1 Record Vendor Invoice	Delivered in Expense and Invoice Tracking. Record vendor invoices and base expense metadata.	Moves Phase 2 - Financial Operations and Budget Control forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:1a525b07-e39d-460f-8ce6-63f26cf194da	8bc174fd-d350-4f41-833f-fc641200ec55	68245579-abd9-419d-813b-169a57a542f7	1a525b07-e39d-460f-8ce6-63f26cf194da	2026-03-06 19:11:07.549	0	system	2026-03-07 16:16:10.614429	2026-03-09 16:02:52.472	- Delivery Need: Record vendor invoices and base expense metadata.	- Delivered Outcome: 3.2.1 Record Vendor Invoice completed in Expense and Invoice Tracking.	{"Execution Item: 3.2.1 Record Vendor Invoice"}
99df46c3-991b-4966-bec8-8568378ba147	Phase 5 - Portals, Communications, and SaaS Expansion: Platform: Multi-Association Data Isolation Foundation	Platform: Multi-Association Data Isolation Foundation	Delivered in Multi-Association Architecture. Establish tenancy boundaries and association-scoped data patterns for future multi-complex scaling.	Moves Phase 5 - Portals, Communications, and SaaS Expansion forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:692c3d0a-2a2c-4c50-9a49-6acbfb82fdc4	567fd831-d3fb-4867-8565-1609e8bea1c2	3488d266-4320-4bdb-8065-5ad104fa3b67	692c3d0a-2a2c-4c50-9a49-6acbfb82fdc4	2026-03-06 21:20:59.769	0	system	2026-03-07 16:16:10.651114	2026-03-09 16:02:52.483	- Delivery Need: Establish tenancy boundaries and association-scoped data patterns for future multi-complex scaling.	- Delivered Outcome: Platform: Multi-Association Data Isolation Foundation completed in Multi-Association Architecture.	{"Execution Item: Platform: Multi-Association Data Isolation Foundation"}
829a766c-0f42-4d2b-8cb5-a1bf0d832729	Phase 4 - Document Intelligence, Intake, and Operational Scale: 4.2.3 Store Parsed Data	4.2.3 Store Parsed Data	Delivered in Record Suggestion Engine. Persist extracted data drafts with review/approval state.	Moves Phase 4 - Document Intelligence, Intake, and Operational Scale forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:856c9886-e612-4d23-a98b-5fd2d6582fc0	b1376498-d4d1-4400-ac8b-3b5a2ce6aea0	22578483-6c12-4d97-b026-62597fcb5e51	856c9886-e612-4d23-a98b-5fd2d6582fc0	2026-03-06 21:13:41.2	0	system	2026-03-07 16:16:10.31612	2026-03-09 16:02:52.359	- Delivery Need: Persist extracted data drafts with review/approval state.	- Delivered Outcome: 4.2.3 Store Parsed Data completed in Record Suggestion Engine.	{"Execution Item: 4.2.3 Store Parsed Data"}
4c5615f1-6715-4219-a6f3-ef4a6e5338a8	Phase 1 - Foundation, Registry, and Core Admin: 4.1.2 Tag Document to Entity	4.1.2 Tag Document to Entity	Delivered in Document Repository. Associate documents with entities such as association, unit, or person.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:bc9cd571-e931-443c-ab45-7e39fa5be4c6	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	88aa305f-0fed-447d-b12c-d1352e3c6120	bc9cd571-e931-443c-ab45-7e39fa5be4c6	2026-03-06 18:16:34.298	0	system	2026-03-07 16:16:10.376566	2026-03-09 16:02:52.38	- Delivery Need: Associate documents with entities such as association, unit, or person.	- Delivered Outcome: 4.1.2 Tag Document to Entity completed in Document Repository.	{"Execution Item: 4.1.2 Tag Document to Entity"}
6eee0935-1bd9-4a7c-935a-c129164babe0	Phase 1 - Foundation, Registry, and Core Admin: 1.3.2 Store Tenant Contact Record	1.3.2 Store Tenant Contact Record	Delivered in Occupancy Contact Tracking. Persist tenant contact records associated with occupied units.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:9f0b89f1-deff-47c1-8617-910779b7aa9a	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	ee2eae57-d340-44f1-879a-f9c791a87286	9f0b89f1-deff-47c1-8617-910779b7aa9a	2026-03-06 18:23:07.345	0	system	2026-03-07 16:16:10.46766	2026-03-09 16:02:52.419	- Delivery Need: Persist tenant contact records associated with occupied units.	- Delivered Outcome: 1.3.2 Store Tenant Contact Record completed in Occupancy Contact Tracking.	{"Execution Item: 1.3.2 Store Tenant Contact Record"}
69b8de03-13f4-4ee9-9676-a516eafda25a	Phase 1 - Foundation, Registry, and Core Admin: 4.1.1 Upload Document	4.1.1 Upload Document	Delivered in Document Repository. Upload and store governing and operational documents.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:6d092649-1d0e-4ffc-84aa-d262846ab69f	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	88aa305f-0fed-447d-b12c-d1352e3c6120	6d092649-1d0e-4ffc-84aa-d262846ab69f	2026-03-06 18:23:07.359	0	system	2026-03-07 16:16:10.512525	2026-03-09 16:02:52.439	- Delivery Need: Upload and store governing and operational documents.	- Delivered Outcome: 4.1.1 Upload Document completed in Document Repository.	{"Execution Item: 4.1.1 Upload Document"}
97a4cec0-7d12-48ab-ac10-177532d46870	Phase 2 - Financial Operations and Budget Control: 3.1.4 Track Owner Ledger Balance	3.1.4 Track Owner Ledger Balance	Delivered in Owner Ledger. Compute and present per-owner charges, payments, and balance.	Moves Phase 2 - Financial Operations and Budget Control forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:b0a06866-d41b-4e54-8d33-9ca7518ae1bf	8bc174fd-d350-4f41-833f-fc641200ec55	819ef8cb-6fd8-41a1-9fe9-f83b7cdcb8ce	b0a06866-d41b-4e54-8d33-9ca7518ae1bf	2026-03-06 19:11:07.566	0	system	2026-03-07 16:16:10.735619	2026-03-09 16:02:52.529	- Delivery Need: Compute and present per-owner charges, payments, and balance.	- Delivered Outcome: 3.1.4 Track Owner Ledger Balance completed in Owner Ledger.	{"Execution Item: 3.1.4 Track Owner Ledger Balance"}
929cda66-9d17-4673-a03f-6bac2e689f16	Phase 1 - Foundation, Registry, and Core Admin: Remediation: Enforce RBAC on All Phase 1 CRUD Routes	Remediation: Enforce RBAC on All Phase 1 CRUD Routes	Delivered in Auth, Roles, and Audit Logging. Apply admin role checks to associations, units, persons, ownerships, occupancies, board roles, and documents endpoints with least-privilege policy.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:86156bbb-266b-4cfe-8f0c-64c663e0c5e1	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	0b8f0f54-dbd3-46d5-a8d3-25b321e2a06b	86156bbb-266b-4cfe-8f0c-64c663e0c5e1	2026-03-06 18:43:02.491	0	system	2026-03-07 16:16:10.749339	2026-03-09 16:02:52.538	- Delivery Need: Apply admin role checks to associations, units, persons, ownerships, occupancies, board roles, and documents endpoints with least-privilege policy.	- Delivered Outcome: Remediation: Enforce RBAC on All Phase 1 CRUD Routes completed in Auth, Roles, and Audit Logging.	{"Execution Item: Remediation: Enforce RBAC on All Phase 1 CRUD Routes"}
1ec56607-e52b-4bbb-818c-ba722e1e3d79	Executive Highlights & Defend Logs: Enforce concise executive copy standards	Enforce concise executive copy standards	Delivered in Executive UI. Apply headline length and summary constraints to keep updates short, clear, and sales-ready.	Moves Executive Highlights & Defend Logs forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:d1428bc6-6977-4645-b60a-ed1cb36900e4	9efff677-7938-4f3f-8580-2bff3e3765c2	7dfc1759-c392-4561-9da4-2defa0b8106f	d1428bc6-6977-4645-b60a-ed1cb36900e4	2026-03-07 16:16:30.598	0	system	2026-03-07 16:41:41.397278	2026-03-09 16:02:52.569	- Delivery Need: Apply headline length and summary constraints to keep updates short, clear, and sales-ready.	- Delivered Outcome: Enforce concise executive copy standards completed in Executive UI.	{"Execution Item: Enforce concise executive copy standards"}
6e90d832-2345-4841-b969-1e8441a7e9fe	Executive Highlights & Defend Logs: Validate end-to-end admin workflow	Validate end-to-end admin workflow	Delivered in Verification & Launch. Confirm users can create, edit, and review executive highlights and defend logs from the admin UI.	Moves Executive Highlights & Defend Logs forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:272f92a3-fb8b-4815-919e-ef76316f3a65	9efff677-7938-4f3f-8580-2bff3e3765c2	ba6bf2dc-d369-451c-8ef1-758754ab9e1b	272f92a3-fb8b-4815-919e-ef76316f3a65	2026-03-07 16:16:30.598	0	system	2026-03-07 16:41:41.417342	2026-03-09 16:02:52.588	- Delivery Need: Confirm users can create, edit, and review executive highlights and defend logs from the admin UI.	- Delivered Outcome: Validate end-to-end admin workflow completed in Verification & Launch.	{"Execution Item: Validate end-to-end admin workflow"}
7e613ad7-fd07-4696-92e2-76766ff1bb08	Phase 4 - Document Intelligence, Intake, and Operational Scale: 4.2.2 Extract Document Metadata	4.2.2 Extract Document Metadata	Delivered in Metadata Extraction. Extract structured metadata from parsed documents for review.	Moves Phase 4 - Document Intelligence, Intake, and Operational Scale forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:4d26e349-f0bb-4ad5-a7cf-2d205987176d	b1376498-d4d1-4400-ac8b-3b5a2ce6aea0	4e2f4861-99c6-4ffa-ab7c-7254b844909d	4d26e349-f0bb-4ad5-a7cf-2d205987176d	2026-03-06 21:13:41.195	0	system	2026-03-07 16:16:10.302231	2026-03-09 16:02:52.348	- Delivery Need: Extract structured metadata from parsed documents for review.	- Delivered Outcome: 4.2.2 Extract Document Metadata completed in Metadata Extraction.	{"Execution Item: 4.2.2 Extract Document Metadata"}
cba51807-154c-42a8-9df7-b6b06a21335e	Executive Highlights & Defend Logs completed	Executive Highlights & Defend Logs reached 100%	Project completed with 8/8 roadmap tasks delivered (100%).	Creates a clean executive proof point for customer-facing progress and product maturity.	draft	roadmap-project	roadmap-project:9efff677-7938-4f3f-8580-2bff3e3765c2	9efff677-7938-4f3f-8580-2bff3e3765c2	\N	\N	2026-03-07 17:02:12.004	0	system	2026-03-07 17:02:12.005859	2026-03-07 17:02:12.005	\N	\N	{}
eaef8d69-01b8-42b3-a47b-4dad7a57533f	Phase 1 - Foundation, Registry, and Core Admin completed	Phase 1 - Foundation, Registry, and Core Admin reached 100%	Project completed with 29/29 roadmap tasks delivered (100%).	Creates a clean executive proof point for customer-facing progress and product maturity.	draft	roadmap-project	roadmap-project:cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	\N	\N	2026-03-07 17:02:12.009	0	system	2026-03-07 17:02:12.010267	2026-03-07 17:02:12.009	\N	\N	{}
f238409c-4e21-44d0-84dd-ab095ab665c4	Phase 1 - Foundation, Registry, and Core Admin: Remediation: Add Permission Change Review Surface	Remediation: Add Permission Change Review Surface	Delivered in Auth, Roles, and Audit Logging. Add admin users page to list users, change roles with required reason, and show validation errors clearly.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:71cb39d3-e321-403d-a52f-e4c381abe7a7	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	0b8f0f54-dbd3-46d5-a8d3-25b321e2a06b	71cb39d3-e321-403d-a52f-e4c381abe7a7	2026-03-06 18:43:02.845	0	system	2026-03-07 16:16:10.706538	2026-03-09 16:02:52.513	- Delivery Need: Add admin users page to list users, change roles with required reason, and show validation errors clearly.	- Delivered Outcome: Remediation: Add Permission Change Review Surface completed in Auth, Roles, and Audit Logging.	{"Execution Item: Remediation: Add Permission Change Review Surface"}
6a37e928-cb02-453a-922b-8d7a62fbd980	Executive Highlights & Defend Logs: Create executive updates and evidence tables	Create executive updates and evidence tables	Delivered in Data Model & API. Add normalized tables for executive highlights and defend/evidence entries with timestamps and ownership.	Moves Executive Highlights & Defend Logs forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:b04448ed-fd26-47da-b6e6-b01238eb15b0	9efff677-7938-4f3f-8580-2bff3e3765c2	a239134c-4744-40dc-8e15-5fc57af2e90f	b04448ed-fd26-47da-b6e6-b01238eb15b0	2026-03-07 16:16:30.598	0	system	2026-03-07 16:41:41.38148	2026-03-09 16:02:52.555	- Delivery Need: Add normalized tables for executive highlights and defend/evidence entries with timestamps and ownership.	- Delivered Outcome: Create executive updates and evidence tables completed in Data Model & API.	{"Execution Item: Create executive updates and evidence tables"}
472f9283-6f3c-4721-8394-0cb85aaf26b2	Phase 2 - Financial Operations and Budget Control completed	Phase 2 - Financial Operations and Budget Control reached 100%	Project completed with 8/8 roadmap tasks delivered (100%).	Creates a clean executive proof point for customer-facing progress and product maturity.	draft	roadmap-project	roadmap-project:8bc174fd-d350-4f41-833f-fc641200ec55	8bc174fd-d350-4f41-833f-fc641200ec55	\N	\N	2026-03-07 17:02:12.014	0	system	2026-03-07 17:02:12.015321	2026-03-07 17:02:12.015	\N	\N	{}
39bbc1d2-b170-456f-82cb-f52569c5a969	Phase 3 - Governance, Meetings, and Compliance Operations completed	Phase 3 - Governance, Meetings, and Compliance Operations reached 100%	Project completed with 9/9 roadmap tasks delivered (100%).	Creates a clean executive proof point for customer-facing progress and product maturity.	draft	roadmap-project	roadmap-project:97747fa0-40e2-4113-b6e6-dba6e033eae4	97747fa0-40e2-4113-b6e6-dba6e033eae4	\N	\N	2026-03-07 17:02:12.018	0	system	2026-03-07 17:02:12.019714	2026-03-07 17:02:12.019	\N	\N	{}
3bb2c5bd-3b60-4a18-ae89-da3558663191	Phase 4 - Document Intelligence, Intake, and Operational Scale completed	Phase 4 - Document Intelligence, Intake, and Operational Scale reached 100%	Project completed with 3/3 roadmap tasks delivered (100%).	Creates a clean executive proof point for customer-facing progress and product maturity.	draft	roadmap-project	roadmap-project:b1376498-d4d1-4400-ac8b-3b5a2ce6aea0	b1376498-d4d1-4400-ac8b-3b5a2ce6aea0	\N	\N	2026-03-07 17:02:12.023	0	system	2026-03-07 17:02:12.024043	2026-03-07 17:02:12.023	\N	\N	{}
3ebed658-05a3-48c2-a4f3-34d3a9ba9f81	Phase 5 - Portals, Communications, and SaaS Expansion completed	Phase 5 - Portals, Communications, and SaaS Expansion reached 100%	Project completed with 5/5 roadmap tasks delivered (100%).	Creates a clean executive proof point for customer-facing progress and product maturity.	draft	roadmap-project	roadmap-project:567fd831-d3fb-4867-8565-1609e8bea1c2	567fd831-d3fb-4867-8565-1609e8bea1c2	\N	\N	2026-03-07 17:02:12.027	0	system	2026-03-07 17:02:12.027827	2026-03-07 17:02:12.027	\N	\N	{}
6cf93067-ed93-408f-a975-0e6c87d7e217	Phase 3 - Governance, Meetings, and Compliance Operations: 5.1.3 Publish Meeting Summary	5.1.3 Publish Meeting Summary	Delivered in Governance Dashboard. Generate and expose approved meeting summary for governance review.	Moves Phase 3 - Governance, Meetings, and Compliance Operations forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:cb9d4c54-2263-4570-8b06-a4330372f53f	97747fa0-40e2-4113-b6e6-dba6e033eae4	977deeb0-def2-4626-bbd6-87aa1af7c651	cb9d4c54-2263-4570-8b06-a4330372f53f	2026-03-06 20:58:23.343	0	system	2026-03-07 16:16:10.216602	2026-03-09 16:02:52.305	- Delivery Need: Generate and expose approved meeting summary for governance review.	- Delivered Outcome: 5.1.3 Publish Meeting Summary completed in Governance Dashboard.	{"Execution Item: 5.1.3 Publish Meeting Summary"}
00181332-a428-4ae3-8f41-016cad7e0d2b	Phase 1 - Foundation, Registry, and Core Admin: Foundation: Configure Association Baseline	Foundation: Configure Association Baseline	Delivered in Association Setup. Establish association profile, governance baseline, and configuration needed by downstream registry modules.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:5bf73ffc-a462-400e-b5d6-1beee5ebcc1e	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	5b4985d7-8e9c-47fb-a9d2-4397c5d424af	5bf73ffc-a462-400e-b5d6-1beee5ebcc1e	2026-03-06 18:23:07.374	0	system	2026-03-07 16:16:10.666947	2026-03-09 16:02:52.493	- Delivery Need: Establish association profile, governance baseline, and configuration needed by downstream registry modules.	- Delivered Outcome: Foundation: Configure Association Baseline completed in Association Setup.	{"Execution Item: Foundation: Configure Association Baseline"}
29207ead-83a4-48f2-a645-7d8c1b5b03a0	Phase 1 - Foundation, Registry, and Core Admin: Remediation: Revalidate and Reclose Phase 1 Exit Criteria	Remediation: Revalidate and Reclose Phase 1 Exit Criteria	Delivered in Association Setup. Run acceptance checklist against implemented behavior and only then mark remaining Phase 1 governance/auth/document tasks complete.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:1c647ab0-f17b-4d18-a74c-7cb779c6ca4f	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	5b4985d7-8e9c-47fb-a9d2-4397c5d424af	1c647ab0-f17b-4d18-a74c-7cb779c6ca4f	2026-03-06 18:44:24.979	0	system	2026-03-07 16:16:10.717885	2026-03-09 16:02:52.524	- Delivery Need: Run acceptance checklist against implemented behavior and only then mark remaining Phase 1 governance/auth/document tasks complete.	- Delivered Outcome: Remediation: Revalidate and Reclose Phase 1 Exit Criteria completed in Association Setup.	{"Execution Item: Remediation: Revalidate and Reclose Phase 1 Exit Criteria"}
b1d81f06-82dc-4b69-ba85-70271e981631	Gap Closure M4 - Bylaw Clause Intelligence: Link clause artifacts to ingestion pipeline	Link clause artifacts to ingestion pipeline	Delivered in Clause Data Model. Persist clause candidates via review-first extraction, keeping all AI outputs editable and traceable to source per FTPH 4.2 implementation notes.	Moves Gap Closure M4 - Bylaw Clause Intelligence forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:7a7eda21-54e2-4980-828c-a899df47c6ac	3ae27457-bc53-46e5-8b09-e752623c97aa	38bb09de-d4b0-4f8c-a679-34074fae37aa	7a7eda21-54e2-4980-828c-a899df47c6ac	2026-03-07 18:12:37.964	0	system	2026-03-07 18:15:44.857962	2026-03-09 16:02:52.73	- Delivery Need: Persist clause candidates via review-first extraction, keeping all AI outputs editable and traceable to source per FTPH 4.2 implementation notes.	- Delivered Outcome: Link clause artifacts to ingestion pipeline completed in Clause Data Model.	{"Execution Item: Link clause artifacts to ingestion pipeline"}
8543fe47-5b6e-404c-bea9-e56639f3e6b9	Gap Closure M3 - Governance Depth (Resolutions, Votes, Calendar) completed	Gap Closure M3 - Governance Depth (Resolutions, Votes, Calendar) reached 100%	Project completed with 7/7 roadmap tasks delivered (100%).	Creates a clean executive proof point for customer-facing progress and product maturity.	published	roadmap-project	slide:roadmap-project:c9a3eb98-e4da-4d17-bac9-b3a4329ed363	c9a3eb98-e4da-4d17-bac9-b3a4329ed363	\N	\N	2026-03-07 18:05:24.403	0	system	2026-03-07 18:15:44.885104	2026-03-07 18:37:11.5	- Program Goal: Complete Gap Closure M3 - Governance Depth (Resolutions, Votes, Calendar) with clear execution tracking.\n- Delivery Requirement: Close all planned roadmap tasks for this phase.	- Execution Result: Gap Closure M3 - Governance Depth (Resolutions, Votes, Calendar) is now complete.\n- Delivery Proof: 7 of 7 tasks are marked done (100%).	{"Delivered Item: Create governance detail schema","Delivered Item: Add storage and API methods for governance details","Delivered Item: Implement resolution lifecycle states","Delivered Item: Create governance calendar API","Delivered Item: Implement starter vote recording (no procedure engine)","Delivered Item: Add calendar UI linked to tasks and meetings","Delivered Item: Enforce meeting-tracker scope boundaries"}
81a9a226-7866-483c-8946-348b6ee78c05	Phase 4 - Document Intelligence, Intake, and Operational Scale completed	Phase 4 - Document Intelligence, Intake, and Operational Scale reached 100%	Project completed with 3/3 roadmap tasks delivered (100%).	Creates a clean executive proof point for customer-facing progress and product maturity.	published	roadmap-project	slide:roadmap-project:b1376498-d4d1-4400-ac8b-3b5a2ce6aea0	b1376498-d4d1-4400-ac8b-3b5a2ce6aea0	\N	\N	2026-03-06 21:13:41.2	0	system	2026-03-07 16:16:10.811818	2026-03-07 18:37:11.527	- Program Goal: Complete Phase 4 - Document Intelligence, Intake, and Operational Scale with clear execution tracking.\n- Delivery Requirement: Close all planned roadmap tasks for this phase.	- Execution Result: Phase 4 - Document Intelligence, Intake, and Operational Scale is now complete.\n- Delivery Proof: 3 of 3 tasks are marked done (100%).	{"Delivered Item: 4.2.1 Upload Raw Document for Parsing","Delivered Item: 4.2.2 Extract Document Metadata","Delivered Item: 4.2.3 Store Parsed Data"}
6edb4b0a-bcdf-4a6e-a0a1-c471ba6e2b19	Gap Closure M4 - Bylaw Clause Intelligence: Enforce review-first AI governance	Enforce review-first AI governance	Delivered in Review and Approval Workflow. Require human approval/edit before production use, with no autonomous legal interpretation, aligned to FTPH 4.2 scope boundary.	Moves Gap Closure M4 - Bylaw Clause Intelligence forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:96cc0378-77b9-464b-83d6-bafc92cc0fdd	3ae27457-bc53-46e5-8b09-e752623c97aa	41105d24-b247-4a4f-b5b3-a46277015f8c	96cc0378-77b9-464b-83d6-bafc92cc0fdd	2026-03-07 18:12:37.964	0	system	2026-03-07 18:15:44.867121	2026-03-09 16:02:52.74	- Delivery Need: Require human approval/edit before production use, with no autonomous legal interpretation, aligned to FTPH 4.2 scope boundary.	- Delivered Outcome: Enforce review-first AI governance completed in Review and Approval Workflow.	{"Execution Item: Enforce review-first AI governance"}
b09c3185-09c6-4fe1-97fb-3ac91a87b46d	Gap Closure M2 - Budget Domain and Variance Controls: Create budget schema entities	Create budget schema entities	Delivered in Budget Data Model. Add Budget, BudgetLine, and BudgetVersion tables plus insert schemas and types.	Moves Gap Closure M2 - Budget Domain and Variance Controls forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:a1051563-b830-46eb-aaf4-c325f4b2e387	fffb518f-1d5f-4ed1-8a3d-8eb036a1fde1	cd3433b1-abd1-4d2f-b25a-cfc439b88253	a1051563-b830-46eb-aaf4-c325f4b2e387	2026-03-07 17:56:23.609	0	system	2026-03-07 18:15:44.752184	2026-03-09 16:02:52.597	- Delivery Need: Add Budget, BudgetLine, and BudgetVersion tables plus insert schemas and types.	- Delivered Outcome: Create budget schema entities completed in Budget Data Model.	{"Execution Item: Create budget schema entities"}
a0d7b6e2-1110-4814-979b-59563b8929fb	Phase 1 - Foundation, Registry, and Core Admin: Remediation: Capture Actor Identity in Unit Change History	Remediation: Capture Actor Identity in Unit Change History	Delivered in Unit Registry. Propagate authenticated admin identity into unit lifecycle history change logs instead of system placeholder values.	Moves Phase 1 - Foundation, Registry, and Core Admin forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:d7ff212b-6c32-45bc-8171-fdc99e4143ab	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	d82033cc-3ed0-4096-96cd-cb426534f216	d7ff212b-6c32-45bc-8171-fdc99e4143ab	2026-03-06 18:43:02.829	0	system	2026-03-07 16:16:10.765404	2026-03-09 16:02:52.546	- Delivery Need: Propagate authenticated admin identity into unit lifecycle history change logs instead of system placeholder values.	- Delivered Outcome: Remediation: Capture Actor Identity in Unit Change History completed in Unit Registry.	{"Execution Item: Remediation: Capture Actor Identity in Unit Change History"}
1e085c18-1efd-4740-94ef-c54f2825c5b4	Gap Closure M1 - Audit Logging and Delete Controls: Introduce canonical AuditLog table	Introduce canonical AuditLog table	Delivered in Audit Model Expansion. Add a global audit table with actor, entity, action, before/after payload, and timestamp.	Moves Gap Closure M1 - Audit Logging and Delete Controls forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:5e31fabd-1e2f-44d2-a4a3-bd3cd5060d11	d869e3c4-d366-44f9-83e6-b6da45e24b80	cac1b596-e280-4d25-bbf8-97d9970e8602	5e31fabd-1e2f-44d2-a4a3-bd3cd5060d11	2026-03-07 17:49:58.593	0	system	2026-03-07 18:15:44.746508	2026-03-09 16:02:52.593	- Delivery Need: Add a global audit table with actor, entity, action, before/after payload, and timestamp.	- Delivered Outcome: Introduce canonical AuditLog table completed in Audit Model Expansion.	{"Execution Item: Introduce canonical AuditLog table"}
b065d118-f8f4-4427-9593-fc896f5c542a	Phase 5 - Portals, Communications, and SaaS Expansion completed	Phase 5 - Portals, Communications, and SaaS Expansion reached 100%	Project completed with 5/5 roadmap tasks delivered (100%).	Creates a clean executive proof point for customer-facing progress and product maturity.	published	roadmap-project	slide:roadmap-project:567fd831-d3fb-4867-8565-1609e8bea1c2	567fd831-d3fb-4867-8565-1609e8bea1c2	\N	\N	2026-03-06 21:20:59.769	0	system	2026-03-07 16:16:10.817339	2026-03-07 18:37:11.531	- Program Goal: Complete Phase 5 - Portals, Communications, and SaaS Expansion with clear execution tracking.\n- Delivery Requirement: Close all planned roadmap tasks for this phase.	- Execution Result: Phase 5 - Portals, Communications, and SaaS Expansion is now complete.\n- Delivery Proof: 5 of 5 tasks are marked done (100%).	{"Delivered Item: Platform: Future Self-Service Permission Envelope","Delivered Item: 7.1.1 Generate Notice Template","Delivered Item: 7.1.2 Send Email Notice","Delivered Item: 7.1.3 Log Communication History","Delivered Item: Platform: Multi-Association Data Isolation Foundation"}
b0006657-5a07-462f-8526-efaa6d581008	Gap Closure M2 - Budget Domain and Variance Controls: Expose budget API endpoints	Expose budget API endpoints	Delivered in Budget Workflow. Add list/create/update and versioning routes under financial APIs.	Moves Gap Closure M2 - Budget Domain and Variance Controls forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:f000e4b7-2827-49e7-ba8d-039479838279	fffb518f-1d5f-4ed1-8a3d-8eb036a1fde1	b0f373fe-725e-46dc-be8f-5601175dc53a	f000e4b7-2827-49e7-ba8d-039479838279	2026-03-07 17:56:23.609	0	system	2026-03-07 18:15:44.762752	2026-03-09 16:02:52.607	- Delivery Need: Add list/create/update and versioning routes under financial APIs.	- Delivered Outcome: Expose budget API endpoints completed in Budget Workflow.	{"Execution Item: Expose budget API endpoints"}
54caab5d-c971-42de-ad79-ec2813ed5b68	Gap Closure M2 - Budget Domain and Variance Controls: Add budget storage interfaces	Add budget storage interfaces	Delivered in Budget Data Model. Implement CRUD/query methods for budget drafts, versions, and line items.	Moves Gap Closure M2 - Budget Domain and Variance Controls forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:c466b1b9-6961-4999-8909-d50592e3d959	fffb518f-1d5f-4ed1-8a3d-8eb036a1fde1	cd3433b1-abd1-4d2f-b25a-cfc439b88253	c466b1b9-6961-4999-8909-d50592e3d959	2026-03-07 17:56:23.609	0	system	2026-03-07 18:15:44.757384	2026-03-09 16:02:52.602	- Delivery Need: Implement CRUD/query methods for budget drafts, versions, and line items.	- Delivered Outcome: Add budget storage interfaces completed in Budget Data Model.	{"Execution Item: Add budget storage interfaces"}
b61258a8-6135-4312-9cb1-b96e314f356b	Gap Closure M3 - Governance Depth (Resolutions, Votes, Calendar): Implement resolution lifecycle states	Implement resolution lifecycle states	Delivered in Resolution and Vote Workflows. Support draft, open, approved, rejected, and archived resolution states.	Moves Gap Closure M3 - Governance Depth (Resolutions, Votes, Calendar) forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:f3fc7d1f-0f61-4efc-98d9-089316df93b4	c9a3eb98-e4da-4d17-bac9-b3a4329ed363	42a0a1bb-8438-4222-8c94-a1fc4f8f9f9b	f3fc7d1f-0f61-4efc-98d9-089316df93b4	2026-03-07 18:05:24.403	0	system	2026-03-07 18:15:44.78562	2026-03-09 16:02:52.631	- Delivery Need: Support draft, open, approved, rejected, and archived resolution states.	- Delivered Outcome: Implement resolution lifecycle states completed in Resolution and Vote Workflows.	{"Execution Item: Implement resolution lifecycle states"}
0ca6e350-b62d-4094-a7a2-9eec7ef45eb7	Gap Closure M3 - Governance Depth (Resolutions, Votes, Calendar): Create governance calendar API	Create governance calendar API	Delivered in Calendar and Timeline Integration. Aggregate meeting events and compliance deadlines into a single event feed.	Moves Gap Closure M3 - Governance Depth (Resolutions, Votes, Calendar) forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:81180397-e23a-4871-96ac-fbfde5c29db3	c9a3eb98-e4da-4d17-bac9-b3a4329ed363	cb6b416f-462b-4a9d-8be4-8467f4d702e1	81180397-e23a-4871-96ac-fbfde5c29db3	2026-03-07 18:05:24.403	0	system	2026-03-07 18:15:44.79033	2026-03-09 16:02:52.636	- Delivery Need: Aggregate meeting events and compliance deadlines into a single event feed.	- Delivered Outcome: Create governance calendar API completed in Calendar and Timeline Integration.	{"Execution Item: Create governance calendar API"}
729c1f38-7c5a-4428-baf6-944b74949c76	Gap Closure M3 - Governance Depth (Resolutions, Votes, Calendar): Implement starter vote recording (no procedure engine)	Implement starter vote recording (no procedure engine)	Delivered in Resolution and Vote Workflows. Capture vote records and basic outcomes while explicitly deferring full parliamentary procedure rules per FTPH 5.1 scope boundary.	Moves Gap Closure M3 - Governance Depth (Resolutions, Votes, Calendar) forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:efa769c0-9504-4680-8b85-fc8f13a4e73e	c9a3eb98-e4da-4d17-bac9-b3a4329ed363	42a0a1bb-8438-4222-8c94-a1fc4f8f9f9b	efa769c0-9504-4680-8b85-fc8f13a4e73e	2026-03-07 18:05:24.403	0	system	2026-03-07 18:15:44.795783	2026-03-09 16:02:52.64	- Delivery Need: Capture vote records and basic outcomes while explicitly deferring full parliamentary procedure rules per FTPH 5.1 scope boundary.	- Delivered Outcome: Implement starter vote recording (no procedure engine) completed in Resolution and Vote Workflows.	{"Execution Item: Implement starter vote recording (no procedure engine)"}
f87ba1ed-0d93-4448-be1b-0656838d0dd1	Gap Closure M1 - Audit Logging and Delete Controls: Backfill existing unit/admin role history into canonical audit model	Backfill existing unit/admin role history into canonical audit model	Delivered in Audit Model Expansion. Normalize prior logging artifacts into shared audit shape for consistent querying.	Moves Gap Closure M1 - Audit Logging and Delete Controls forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:f248438a-04ea-4cf4-a101-450b896ff925	d869e3c4-d366-44f9-83e6-b6da45e24b80	cac1b596-e280-4d25-bbf8-97d9970e8602	f248438a-04ea-4cf4-a101-450b896ff925	2026-03-07 17:49:58.593	0	system	2026-03-07 18:15:44.799707	2026-03-09 16:02:52.653	- Delivery Need: Normalize prior logging artifacts into shared audit shape for consistent querying.	- Delivered Outcome: Backfill existing unit/admin role history into canonical audit model completed in Audit Model Expansion.	{"Execution Item: Backfill existing unit/admin role history into canonical audit model"}
88c84e74-275d-49bd-b6fe-5cabd284b790	Gap Closure M2 - Budget Domain and Variance Controls: Add budget-vs-actual report	Add budget-vs-actual report	Delivered in Budget UX and Reporting. Compute and display planned vs actual variance by account/category and period.	Moves Gap Closure M2 - Budget Domain and Variance Controls forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:e9a38198-a817-449e-8a31-b4f598a6318d	fffb518f-1d5f-4ed1-8a3d-8eb036a1fde1	0d4b4801-1f8d-44ef-aa47-ad1c936d9dbc	e9a38198-a817-449e-8a31-b4f598a6318d	2026-03-07 17:56:23.609	0	system	2026-03-07 18:15:44.77252	2026-03-09 16:02:52.618	- Delivery Need: Compute and display planned vs actual variance by account/category and period.	- Delivered Outcome: Add budget-vs-actual report completed in Budget UX and Reporting.	{"Execution Item: Add budget-vs-actual report"}
44f86074-6009-453b-a655-d530cfaceb9a	Gap Closure M3 - Governance Depth (Resolutions, Votes, Calendar): Create governance detail schema	Create governance detail schema	Delivered in Governance Entity Expansion. Add MeetingAgendaItem, MeetingNote, Resolution, VoteRecord, and CalendarEvent tables.	Moves Gap Closure M3 - Governance Depth (Resolutions, Votes, Calendar) forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:c3aad6fd-6b04-4479-8388-a2a575a7f392	c9a3eb98-e4da-4d17-bac9-b3a4329ed363	ec61576c-d724-4268-a393-1947cd2c7830	c3aad6fd-6b04-4479-8388-a2a575a7f392	2026-03-07 18:05:24.403	0	system	2026-03-07 18:15:44.777177	2026-03-09 16:02:52.623	- Delivery Need: Add MeetingAgendaItem, MeetingNote, Resolution, VoteRecord, and CalendarEvent tables.	- Delivered Outcome: Create governance detail schema completed in Governance Entity Expansion.	{"Execution Item: Create governance detail schema"}
a499c103-32ab-4e4f-94e8-d61cb6ba00b2	Gap Closure M3 - Governance Depth (Resolutions, Votes, Calendar): Add storage and API methods for governance details	Add storage and API methods for governance details	Delivered in Governance Entity Expansion. Implement endpoints for creating, searching, and updating governance artifacts.	Moves Gap Closure M3 - Governance Depth (Resolutions, Votes, Calendar) forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:0df6040c-19ed-4c9b-8a6d-e6818bc6b224	c9a3eb98-e4da-4d17-bac9-b3a4329ed363	ec61576c-d724-4268-a393-1947cd2c7830	0df6040c-19ed-4c9b-8a6d-e6818bc6b224	2026-03-07 18:05:24.403	0	system	2026-03-07 18:15:44.781644	2026-03-09 16:02:52.627	- Delivery Need: Implement endpoints for creating, searching, and updating governance artifacts.	- Delivered Outcome: Add storage and API methods for governance details completed in Governance Entity Expansion.	{"Execution Item: Add storage and API methods for governance details"}
19709c05-a8ed-4205-8d12-20a9c9c88589	Gap Closure M2 - Budget Domain and Variance Controls: Implement budget draft and ratification states	Implement budget draft and ratification states	Delivered in Budget Workflow. Support draft/proposed/ratified lifecycle transitions aligned with FTPH 6.1 annual checklist obligations (budget review and ratification).	Moves Gap Closure M2 - Budget Domain and Variance Controls forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:f8ce9ec9-3784-48fd-883a-a940d4f10061	fffb518f-1d5f-4ed1-8a3d-8eb036a1fde1	b0f373fe-725e-46dc-be8f-5601175dc53a	f8ce9ec9-3784-48fd-883a-a940d4f10061	2026-03-07 17:56:23.609	0	system	2026-03-07 18:15:44.821967	2026-03-09 16:02:52.676	- Delivery Need: Support draft/proposed/ratified lifecycle transitions aligned with FTPH 6.1 annual checklist obligations (budget review and ratification).	- Delivered Outcome: Implement budget draft and ratification states completed in Budget Workflow.	{"Execution Item: Implement budget draft and ratification states"}
ce47fdb7-bb05-4f83-8ec3-bbc69dd4b186	Gap Closure M3 - Governance Depth (Resolutions, Votes, Calendar): Add calendar UI linked to tasks and meetings	Add calendar UI linked to tasks and meetings	Delivered in Calendar and Timeline Integration. Render upcoming obligations with drilldown into records and owners.	Moves Gap Closure M3 - Governance Depth (Resolutions, Votes, Calendar) forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:9212a9c4-47d2-4793-bbe2-a2f80ef2ccf6	c9a3eb98-e4da-4d17-bac9-b3a4329ed363	cb6b416f-462b-4a9d-8be4-8467f4d702e1	9212a9c4-47d2-4793-bbe2-a2f80ef2ccf6	2026-03-07 18:05:24.403	0	system	2026-03-07 18:15:44.827514	2026-03-09 16:02:52.681	- Delivery Need: Render upcoming obligations with drilldown into records and owners.	- Delivered Outcome: Add calendar UI linked to tasks and meetings completed in Calendar and Timeline Integration.	{"Execution Item: Add calendar UI linked to tasks and meetings"}
9f2a4d4d-65f6-4ff4-b6a1-97ca77f4edb5	Gap Closure M3 - Governance Depth (Resolutions, Votes, Calendar): Enforce meeting-tracker scope boundaries	Enforce meeting-tracker scope boundaries	Delivered in Resolution and Vote Workflows. Preserve FTPH 5.1 boundaries by shipping starter vote capture only and deferring full voting procedure engines and scheduling integrations.	Moves Gap Closure M3 - Governance Depth (Resolutions, Votes, Calendar) forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:73e64d27-2dbb-4810-8f01-d9c28a03964b	c9a3eb98-e4da-4d17-bac9-b3a4329ed363	42a0a1bb-8438-4222-8c94-a1fc4f8f9f9b	73e64d27-2dbb-4810-8f01-d9c28a03964b	2026-03-07 18:05:24.403	0	system	2026-03-07 18:15:44.832809	2026-03-09 16:02:52.685	- Delivery Need: Preserve FTPH 5.1 boundaries by shipping starter vote capture only and deferring full voting procedure engines and scheduling integrations.	- Delivered Outcome: Enforce meeting-tracker scope boundaries completed in Resolution and Vote Workflows.	{"Execution Item: Enforce meeting-tracker scope boundaries"}
81382f0f-538a-4dd3-aad8-329119a31e2a	Gap Closure M4 - Bylaw Clause Intelligence: Create clause intelligence schema	Create clause intelligence schema	Delivered in Clause Data Model. Add ClauseRecord, ClauseTag, and SuggestedLink entities with provenance metadata.	Moves Gap Closure M4 - Bylaw Clause Intelligence forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:87be893a-fd9e-4241-aa50-88bb83335631	3ae27457-bc53-46e5-8b09-e752623c97aa	38bb09de-d4b0-4f8c-a679-34074fae37aa	87be893a-fd9e-4241-aa50-88bb83335631	2026-03-07 18:12:37.964	0	system	2026-03-07 18:15:44.837486	2026-03-09 16:02:52.689	- Delivery Need: Add ClauseRecord, ClauseTag, and SuggestedLink entities with provenance metadata.	- Delivered Outcome: Create clause intelligence schema completed in Clause Data Model.	{"Execution Item: Create clause intelligence schema"}
32966451-5fe2-4cfc-b707-17ad1d64d4cd	Gap Closure M1 - Audit Logging and Delete Controls: Add integrity guards for destructive actions	Add integrity guards for destructive actions	Delivered in Delete API and Safeguards. Block or cascade deletes safely when linked records would become invalid.	Moves Gap Closure M1 - Audit Logging and Delete Controls forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:e607c7c9-8a94-40a6-a862-b900ce9f2f6e	d869e3c4-d366-44f9-83e6-b6da45e24b80	8d4444eb-d064-4d14-8d78-907ce38c5d46	e607c7c9-8a94-40a6-a862-b900ce9f2f6e	2026-03-07 17:49:58.593	0	system	2026-03-07 18:15:44.808347	2026-03-09 16:02:52.663	- Delivery Need: Block or cascade deletes safely when linked records would become invalid.	- Delivered Outcome: Add integrity guards for destructive actions completed in Delete API and Safeguards.	{"Execution Item: Add integrity guards for destructive actions"}
463e501b-2bd0-4c21-bfcc-e311169256a6	Gap Closure M1 - Audit Logging and Delete Controls: Enforce audit writes on all mutation endpoints	Enforce audit writes on all mutation endpoints	Delivered in Audit Enforcement and Verification. Wrap service-layer create/update/delete operations with mandatory audit event emission.	Moves Gap Closure M1 - Audit Logging and Delete Controls forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:eec2d713-8fdb-49ef-bb48-becf5af664ba	d869e3c4-d366-44f9-83e6-b6da45e24b80	dcadbc09-72d6-4a38-bd3d-a14dc047fb26	eec2d713-8fdb-49ef-bb48-becf5af664ba	2026-03-07 17:49:58.593	0	system	2026-03-07 18:15:44.812819	2026-03-09 16:02:52.667	- Delivery Need: Wrap service-layer create/update/delete operations with mandatory audit event emission.	- Delivered Outcome: Enforce audit writes on all mutation endpoints completed in Audit Enforcement and Verification.	{"Execution Item: Enforce audit writes on all mutation endpoints"}
79a2aa26-de1a-47ee-9d47-83d03d0155e3	Gap Closure M1 - Audit Logging and Delete Controls: Add verification script for CRUD audit coverage	Add verification script for CRUD audit coverage	Delivered in Audit Enforcement and Verification. Validate all mutating endpoints generate audit records with actor attribution.	Moves Gap Closure M1 - Audit Logging and Delete Controls forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:82d3c2e4-57e9-4efa-adff-d6aa0cf939b0	d869e3c4-d366-44f9-83e6-b6da45e24b80	dcadbc09-72d6-4a38-bd3d-a14dc047fb26	82d3c2e4-57e9-4efa-adff-d6aa0cf939b0	2026-03-07 17:49:58.593	0	system	2026-03-07 18:15:44.817386	2026-03-09 16:02:52.672	- Delivery Need: Validate all mutating endpoints generate audit records with actor attribution.	- Delivered Outcome: Add verification script for CRUD audit coverage completed in Audit Enforcement and Verification.	{"Execution Item: Add verification script for CRUD audit coverage"}
baf4d208-07cf-4883-894d-229cc7959acb	Gap Closure M4 - Bylaw Clause Intelligence: Add clause review endpoints	Add clause review endpoints	Delivered in Review and Approval Workflow. Expose API operations for review status, edits, and tag assignment for clause drafts.	Moves Gap Closure M4 - Bylaw Clause Intelligence forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:4776dfe2-d7c0-470c-8207-26891185eb6a	3ae27457-bc53-46e5-8b09-e752623c97aa	41105d24-b247-4a4f-b5b3-a46277015f8c	4776dfe2-d7c0-470c-8207-26891185eb6a	2026-03-07 18:12:37.964	0	system	2026-03-07 18:15:44.842676	2026-03-09 16:02:52.693	- Delivery Need: Expose API operations for review status, edits, and tag assignment for clause drafts.	- Delivered Outcome: Add clause review endpoints completed in Review and Approval Workflow.	{"Execution Item: Add clause review endpoints"}
ff0e4e85-b13c-4f08-aad1-ba0b3b4f0e58	Gap Closure M4 - Bylaw Clause Intelligence: Add clause search and filtering	Add clause search and filtering	Delivered in Bylaw Knowledge Reuse. Support filter by topic/tag/source document and confidence/review state.	Moves Gap Closure M4 - Bylaw Clause Intelligence forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:c310c324-a253-45f0-a7d7-4aeca1be7034	3ae27457-bc53-46e5-8b09-e752623c97aa	503cf11f-e63c-46e5-877d-199c15cc0d26	c310c324-a253-45f0-a7d7-4aeca1be7034	2026-03-07 18:12:37.964	0	system	2026-03-07 18:15:44.853401	2026-03-09 16:02:52.725	- Delivery Need: Support filter by topic/tag/source document and confidence/review state.	- Delivered Outcome: Add clause search and filtering completed in Bylaw Knowledge Reuse.	{"Execution Item: Add clause search and filtering"}
5142a807-1180-47fb-8fd7-3bf0bbbc3532	Gap Closure M4 - Bylaw Clause Intelligence: Expose approved clause references to governance modules	Expose approved clause references to governance modules	Delivered in Bylaw Knowledge Reuse. Link approved clauses to governance templates/tasks without autonomous legal interpretation, consistent with FTPH 4.2 scope boundary and CT-first rollout assumptions.	Moves Gap Closure M4 - Bylaw Clause Intelligence forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:85b03e87-0324-4845-b2cb-e0701ac3e7ab	3ae27457-bc53-46e5-8b09-e752623c97aa	503cf11f-e63c-46e5-877d-199c15cc0d26	85b03e87-0324-4845-b2cb-e0701ac3e7ab	2026-03-07 18:12:37.964	0	system	2026-03-07 18:15:44.862767	2026-03-09 16:02:52.735	- Delivery Need: Link approved clauses to governance templates/tasks without autonomous legal interpretation, consistent with FTPH 4.2 scope boundary and CT-first rollout assumptions.	- Delivered Outcome: Expose approved clause references to governance modules completed in Bylaw Knowledge Reuse.	{"Execution Item: Expose approved clause references to governance modules"}
0a37a2e3-b421-4093-81ed-b4b50253a7d9	Gap Closure M4 - Bylaw Clause Intelligence: Extend AI ingestion UI for clause review	Extend AI ingestion UI for clause review	Delivered in Review and Approval Workflow. Add before/after editing, confidence display, and approval controls for clause records.	Moves Gap Closure M4 - Bylaw Clause Intelligence forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:738c0215-ca17-43e4-b29e-c3a9bfa9a6ce	3ae27457-bc53-46e5-8b09-e752623c97aa	41105d24-b247-4a4f-b5b3-a46277015f8c	738c0215-ca17-43e4-b29e-c3a9bfa9a6ce	2026-03-07 18:12:37.964	0	system	2026-03-07 18:15:44.847662	2026-03-09 16:02:52.721	- Delivery Need: Add before/after editing, confidence display, and approval controls for clause records.	- Delivered Outcome: Extend AI ingestion UI for clause review completed in Review and Approval Workflow.	{"Execution Item: Extend AI ingestion UI for clause review"}
95ba643e-0e10-4631-9915-033994f7ebd0	Gap Closure M2 - Budget Domain and Variance Controls completed	Gap Closure M2 - Budget Domain and Variance Controls reached 100%	Project completed with 6/6 roadmap tasks delivered (100%).	Creates a clean executive proof point for customer-facing progress and product maturity.	published	roadmap-project	slide:roadmap-project:fffb518f-1d5f-4ed1-8a3d-8eb036a1fde1	fffb518f-1d5f-4ed1-8a3d-8eb036a1fde1	\N	\N	2026-03-07 17:56:23.609	0	system	2026-03-07 18:15:44.880667	2026-03-07 18:37:11.496	- Program Goal: Complete Gap Closure M2 - Budget Domain and Variance Controls with clear execution tracking.\n- Delivery Requirement: Close all planned roadmap tasks for this phase.	- Execution Result: Gap Closure M2 - Budget Domain and Variance Controls is now complete.\n- Delivery Proof: 6 of 6 tasks are marked done (100%).	{"Delivered Item: Create budget schema entities","Delivered Item: Add budget storage interfaces","Delivered Item: Expose budget API endpoints","Delivered Item: Build budget management screens","Delivered Item: Add budget-vs-actual report","Delivered Item: Implement budget draft and ratification states"}
c5dcfd32-b1a3-4fba-8f4c-98c98608d4e2	Gap Closure M4 - Bylaw Clause Intelligence completed	Gap Closure M4 - Bylaw Clause Intelligence reached 100%	Project completed with 7/7 roadmap tasks delivered (100%).	Creates a clean executive proof point for customer-facing progress and product maturity.	published	roadmap-project	slide:roadmap-project:3ae27457-bc53-46e5-8b09-e752623c97aa	3ae27457-bc53-46e5-8b09-e752623c97aa	\N	\N	2026-03-07 18:12:37.964	0	system	2026-03-07 18:15:44.889384	2026-03-07 18:37:11.504	- Program Goal: Complete Gap Closure M4 - Bylaw Clause Intelligence with clear execution tracking.\n- Delivery Requirement: Close all planned roadmap tasks for this phase.	- Execution Result: Gap Closure M4 - Bylaw Clause Intelligence is now complete.\n- Delivery Proof: 7 of 7 tasks are marked done (100%).	{"Delivered Item: Create clause intelligence schema","Delivered Item: Add clause review endpoints","Delivered Item: Extend AI ingestion UI for clause review","Delivered Item: Add clause search and filtering","Delivered Item: Link clause artifacts to ingestion pipeline","Delivered Item: Expose approved clause references to governance modules","Delivered Item: Enforce review-first AI governance"}
050c08c1-3a80-453a-a6a1-51cbeba9f9f5	Gap Closure M5 - Owner Portal and SaaS Tenancy: Enforce owner-safe authorization	Enforce owner-safe authorization	Delivered in Portal and Membership Model. Implement scoped permission checks for owner-facing reads and profile updates.	Moves Gap Closure M5 - Owner Portal and SaaS Tenancy forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:7277168d-d52f-4d2e-aac5-f26414f8984e	bdcc5149-54c7-4b58-9581-e98ffaf685cc	60cec03b-5b57-42d6-a2ac-767612f7cfa6	7277168d-d52f-4d2e-aac5-f26414f8984e	2026-03-07 18:23:12.773	0	system	2026-03-07 18:30:58.651301	2026-03-09 16:02:52.649	- Delivery Need: Implement scoped permission checks for owner-facing reads and profile updates.	- Delivered Outcome: Enforce owner-safe authorization completed in Portal and Membership Model.	{"Execution Item: Enforce owner-safe authorization"}
278a175e-2fda-4191-9a40-897144c2e6f0	Gap Closure M5 - Owner Portal and SaaS Tenancy completed	Gap Closure M5 - Owner Portal and SaaS Tenancy reached 100%	Project completed with 7/7 roadmap tasks delivered (100%).	Creates a clean executive proof point for customer-facing progress and product maturity.	published	roadmap-project	slide:roadmap-project:bdcc5149-54c7-4b58-9581-e98ffaf685cc	bdcc5149-54c7-4b58-9581-e98ffaf685cc	\N	\N	2026-03-07 18:23:12.773	0	system	2026-03-07 18:34:12.086435	2026-03-07 18:37:11.518	- Program Goal: Complete Gap Closure M5 - Owner Portal and SaaS Tenancy with clear execution tracking.\n- Delivery Requirement: Close all planned roadmap tasks for this phase.	- Execution Result: Gap Closure M5 - Owner Portal and SaaS Tenancy is now complete.\n- Delivery Proof: 7 of 7 tasks are marked done (100%).	{"Delivered Item: Create portal access schema","Delivered Item: Enforce owner-safe authorization","Delivered Item: Build owner portal routes and layout","Delivered Item: Implement contact update workflow","Delivered Item: Add TenantConfig and EmailThread entities","Delivered Item: Add cross-association isolation tests","Delivered Item: Gate owner portal rollout as future-expansion capability"}
b04b9ef1-92e0-4162-a0df-e54620bd7c5c	Phase 3 - Governance, Meetings, and Compliance Operations completed	Phase 3 - Governance, Meetings, and Compliance Operations reached 100%	Project completed with 9/9 roadmap tasks delivered (100%).	Creates a clean executive proof point for customer-facing progress and product maturity.	published	roadmap-project	slide:roadmap-project:97747fa0-40e2-4113-b6e6-dba6e033eae4	97747fa0-40e2-4113-b6e6-dba6e033eae4	\N	\N	2026-03-06 20:58:23.35	0	system	2026-03-07 16:16:10.805213	2026-03-07 18:37:11.523	- Program Goal: Complete Phase 3 - Governance, Meetings, and Compliance Operations with clear execution tracking.\n- Delivery Requirement: Close all planned roadmap tasks for this phase.	- Execution Result: Phase 3 - Governance, Meetings, and Compliance Operations is now complete.\n- Delivery Proof: 9 of 9 tasks are marked done (100%).	{"Delivered Item: 5.1.1 Schedule Meeting Record","Delivered Item: 5.1.2 Record Meeting Notes","Delivered Item: 5.1.3 Publish Meeting Summary","Delivered Item: Governance: Kanban/Workstream Task Visibility","Delivered Item: Governance: Budget Meeting Support Workflow","Delivered Item: 6.1.2 Track Task Completion","Delivered Item: 6.1.3 Display Compliance Dashboard","Delivered Item: 6.1.1 Create Annual Governance Tasks"}
04bac2ff-0e94-4056-9860-dcc3fd6c2a5c	AI Ingestion Rebuild - Cross-Module Data Intake: Expand source parsing coverage for common admin artifacts	Expand source parsing coverage for common admin artifacts	Delivered in Intake Experience and Input Handling. Handle owner rosters, contact lists, invoices, and bank statement exports with reliable normalization for csv, txt, json, and future document formats.	Moves AI Ingestion Rebuild - Cross-Module Data Intake forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:15633a53-a2e7-48ae-a6ee-38362fdffb12	a5451dd1-b5a1-44a7-b936-f34232faf0e5	e2aaa811-ca25-4894-8c8e-d6419e7227ac	15633a53-a2e7-48ae-a6ee-38362fdffb12	2026-03-09 15:20:44.989	0	system	2026-03-09 15:56:00.359944	2026-03-09 16:02:52.745	- Delivery Need: Handle owner rosters, contact lists, invoices, and bank statement exports with reliable normalization for csv, txt, json, and future document formats.	- Delivered Outcome: Expand source parsing coverage for common admin artifacts completed in Intake Experience and Input Handling.	{"Execution Item: Expand source parsing coverage for common admin artifacts"}
a197efa1-0281-4ff6-b71d-dd05bc514a66	Gap Closure M1 - Audit Logging and Delete Controls completed	Gap Closure M1 - Audit Logging and Delete Controls reached 100%	Project completed with 6/6 roadmap tasks delivered (100%).	Creates a clean executive proof point for customer-facing progress and product maturity.	published	roadmap-project	slide:roadmap-project:d869e3c4-d366-44f9-83e6-b6da45e24b80	d869e3c4-d366-44f9-83e6-b6da45e24b80	\N	\N	2026-03-07 17:49:58.593	0	system	2026-03-07 18:15:44.876897	2026-03-07 18:37:11.492	- Program Goal: Complete Gap Closure M1 - Audit Logging and Delete Controls with clear execution tracking.\n- Delivery Requirement: Close all planned roadmap tasks for this phase.	- Execution Result: Gap Closure M1 - Audit Logging and Delete Controls is now complete.\n- Delivery Proof: 6 of 6 tasks are marked done (100%).	{"Delivered Item: Introduce canonical AuditLog table","Delivered Item: Backfill existing unit/admin role history into canonical audit model","Delivered Item: Add delete handlers for Phase 1 registries","Delivered Item: Add integrity guards for destructive actions","Delivered Item: Enforce audit writes on all mutation endpoints","Delivered Item: Add verification script for CRUD audit coverage"}
480d2f9a-d00e-4cb0-a281-17a5fad7d632	Phase 2 - Financial Operations and Budget Control completed	Phase 2 - Financial Operations and Budget Control reached 100%	Project completed with 8/8 roadmap tasks delivered (100%).	Creates a clean executive proof point for customer-facing progress and product maturity.	published	roadmap-project	slide:roadmap-project:8bc174fd-d350-4f41-833f-fc641200ec55	8bc174fd-d350-4f41-833f-fc641200ec55	\N	\N	2026-03-06 19:11:07.57	0	system	2026-03-07 16:16:10.797621	2026-03-07 18:37:11.513	- Program Goal: Complete Phase 2 - Financial Operations and Budget Control with clear execution tracking.\n- Delivery Requirement: Close all planned roadmap tasks for this phase.	- Execution Result: Phase 2 - Financial Operations and Budget Control is now complete.\n- Delivery Proof: 8 of 8 tasks are marked done (100%).	{"Delivered Item: 3.1.2 Create Special Assessment","Delivered Item: 3.1.1 Create HOA Fee Schedule","Delivered Item: 3.2.2 Track Utility Payments","Delivered Item: 3.1.3 Calculate Late Fees","Delivered Item: 3.2.1 Record Vendor Invoice","Delivered Item: 3.2.3 Store Expense Attachments","Delivered Item: 3.1.4 Track Owner Ledger Balance","Delivered Item: Finance Foundation: Configure Financial Accounts and Categories"}
028ebb50-ac8b-483f-93a0-09c121c54baa	AI Ingestion Rebuild - Cross-Module Data Intake: Capture import audit trail and provenance links	Capture import audit trail and provenance links	Delivered in Review Workflow, Auditability, and Recovery. Store who approved what, source job reference, extracted payload snapshot, target entity IDs, and timestamps for traceability and compliance review.	Moves AI Ingestion Rebuild - Cross-Module Data Intake forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:7e83eb73-7a41-4194-bccd-8174028d1551	a5451dd1-b5a1-44a7-b936-f34232faf0e5	c7aa0a43-ddb8-4e06-bfc9-b66c32d28243	7e83eb73-7a41-4194-bccd-8174028d1551	2026-03-09 15:23:43.857	0	system	2026-03-09 15:56:00.370735	2026-03-09 16:02:52.754	- Delivery Need: Store who approved what, source job reference, extracted payload snapshot, target entity IDs, and timestamps for traceability and compliance review.	- Delivered Outcome: Capture import audit trail and provenance links completed in Review Workflow, Auditability, and Recovery.	{"Execution Item: Capture import audit trail and provenance links"}
132c3370-8ceb-4f05-b817-95e4f4437698	AI Ingestion Rebuild - Cross-Module Data Intake: Redesign review UI for record-level approve/edit/reject	Redesign review UI for record-level approve/edit/reject	Delivered in Review Workflow, Auditability, and Recovery. Show extracted records grouped by target module with confidence, source excerpts, and inline correction before approval.	Moves AI Ingestion Rebuild - Cross-Module Data Intake forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:dc8893fb-9987-48fe-a644-184c7e7e38ef	a5451dd1-b5a1-44a7-b936-f34232faf0e5	c7aa0a43-ddb8-4e06-bfc9-b66c32d28243	dc8893fb-9987-48fe-a644-184c7e7e38ef	2026-03-09 15:36:13.689	0	system	2026-03-09 15:56:00.375324	2026-03-09 16:02:52.765	- Delivery Need: Show extracted records grouped by target module with confidence, source excerpts, and inline correction before approval.	- Delivered Outcome: Redesign review UI for record-level approve/edit/reject completed in Review Workflow, Auditability, and Recovery.	{"Execution Item: Redesign review UI for record-level approve/edit/reject"}
d6910202-0f3a-47a4-a68a-d5e4b52f59f4	AI Ingestion Rebuild - Cross-Module Data Intake: Create verification scripts for end-to-end ingestion scenarios	Create verification scripts for end-to-end ingestion scenarios	Delivered in Quality Gate and Launch Readiness. Automate validation of representative owner list, contact update, invoice, and bank statement ingestion flows from intake to module write.	Moves AI Ingestion Rebuild - Cross-Module Data Intake forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:cc1c1313-1a97-4b68-adaa-3faee58e6e90	a5451dd1-b5a1-44a7-b936-f34232faf0e5	91084474-44ad-48fa-8ef4-b80051ab3a47	cc1c1313-1a97-4b68-adaa-3faee58e6e90	2026-03-09 15:36:13.689	0	system	2026-03-09 15:56:00.379674	2026-03-09 16:02:52.769	- Delivery Need: Automate validation of representative owner list, contact update, invoice, and bank statement ingestion flows from intake to module write.	- Delivered Outcome: Create verification scripts for end-to-end ingestion scenarios completed in Quality Gate and Launch Readiness.	{"Execution Item: Create verification scripts for end-to-end ingestion scenarios"}
298d70c1-b59f-4863-8b6b-d15902f28703	AI Ingestion Rebuild - Cross-Module Data Intake: Define ingestion accuracy benchmarks by document type	Define ingestion accuracy benchmarks by document type	Delivered in Quality Gate and Launch Readiness. Track precision/recall style metrics for key fields and require minimum pass thresholds before release for each supported document category.	Moves AI Ingestion Rebuild - Cross-Module Data Intake forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:06fd9a84-b928-46cd-ba34-91b35e08ed95	a5451dd1-b5a1-44a7-b936-f34232faf0e5	91084474-44ad-48fa-8ef4-b80051ab3a47	06fd9a84-b928-46cd-ba34-91b35e08ed95	2026-03-09 15:40:53.669	0	system	2026-03-09 15:56:00.384413	2026-03-09 16:02:52.775	- Delivery Need: Track precision/recall style metrics for key fields and require minimum pass thresholds before release for each supported document category.	- Delivered Outcome: Define ingestion accuracy benchmarks by document type completed in Quality Gate and Launch Readiness.	{"Execution Item: Define ingestion accuracy benchmarks by document type"}
120dd082-d183-471d-adb1-e0ee9bf6fbec	AI Ingestion Rebuild - Cross-Module Data Intake: Run staged rollout with monitoring and alerting	Run staged rollout with monitoring and alerting	Delivered in Quality Gate and Launch Readiness. Release behind a feature flag, monitor ingestion success/failure patterns, and alert on classification drift, routing errors, and abnormal duplicate rates.	Moves AI Ingestion Rebuild - Cross-Module Data Intake forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:99b3721f-a91f-42f7-9107-4cc2525cc318	a5451dd1-b5a1-44a7-b936-f34232faf0e5	91084474-44ad-48fa-8ef4-b80051ab3a47	99b3721f-a91f-42f7-9107-4cc2525cc318	2026-03-09 15:49:59.213	0	system	2026-03-09 15:56:00.388818	2026-03-09 16:02:52.781	- Delivery Need: Release behind a feature flag, monitor ingestion success/failure patterns, and alert on classification drift, routing errors, and abnormal duplicate rates.	- Delivered Outcome: Run staged rollout with monitoring and alerting completed in Quality Gate and Launch Readiness.	{"Execution Item: Run staged rollout with monitoring and alerting"}
f2dc4fcb-451b-413e-b0aa-3f5e2c1b54c9	AI Ingestion Rebuild - Cross-Module Data Intake: Add fallback heuristics and partial extraction handling	Add fallback heuristics and partial extraction handling	Delivered in AI Extraction and Document Type Intelligence. When AI responses are incomplete or low-confidence, preserve partially extracted records, mark uncertainty reasons, and route for review rather than silently failing.	Moves AI Ingestion Rebuild - Cross-Module Data Intake forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:680ce5f1-30e5-4d7e-bf01-2bee68350802	a5451dd1-b5a1-44a7-b936-f34232faf0e5	88165f6f-dd3b-44af-bbf5-6b8008503d0e	680ce5f1-30e5-4d7e-bf01-2bee68350802	2026-03-09 15:20:44.989	0	system	2026-03-09 15:56:00.40064	2026-03-09 16:02:52.794	- Delivery Need: When AI responses are incomplete or low-confidence, preserve partially extracted records, mark uncertainty reasons, and route for review rather than silently failing.	- Delivered Outcome: Add fallback heuristics and partial extraction handling completed in AI Extraction and Document Type Intelligence.	{"Execution Item: Add fallback heuristics and partial extraction handling"}
bd85ff0a-7d69-485d-bef7-1d68be73f237	AI Ingestion Rebuild - Cross-Module Data Intake: Implement staged import pipeline with dry-run and commit modes	Implement staged import pipeline with dry-run and commit modes	Delivered in Module Routing and Import Execution. Provide preview mode that shows creates/updates/skips before write operations, then execute commit with per-row outcomes and idempotency protections.	Moves AI Ingestion Rebuild - Cross-Module Data Intake forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:305d8863-88f6-428e-8f63-4b652f539a65	a5451dd1-b5a1-44a7-b936-f34232faf0e5	78091e86-1b8c-4ee7-8461-6b45d782f9f5	305d8863-88f6-428e-8f63-4b652f539a65	2026-03-09 15:20:44.989	0	system	2026-03-09 15:56:00.408928	2026-03-09 16:02:52.803	- Delivery Need: Provide preview mode that shows creates/updates/skips before write operations, then execute commit with per-row outcomes and idempotency protections.	- Delivered Outcome: Implement staged import pipeline with dry-run and commit modes completed in Module Routing and Import Execution.	{"Execution Item: Implement staged import pipeline with dry-run and commit modes"}
becec66e-3f35-4f42-a1d8-67db2b8f1805	AI Ingestion Rebuild - Cross-Module Data Intake: Unify intake into file upload or pasted text with contextual notes	Unify intake into file upload or pasted text with contextual notes	Delivered in Intake Experience and Input Handling. Allow an admin to provide a file, pasted text, or both, plus optional context instructions (for example period, association intent, and reconciliation notes) while retaining current job submission and review patterns.	Moves AI Ingestion Rebuild - Cross-Module Data Intake forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:a4cd64b3-1dc0-4794-902f-c502fcfefc75	a5451dd1-b5a1-44a7-b936-f34232faf0e5	e2aaa811-ca25-4894-8c8e-d6419e7227ac	a4cd64b3-1dc0-4794-902f-c502fcfefc75	2026-03-09 15:20:44.989	0	system	2026-03-09 15:56:00.413079	2026-03-09 16:02:52.807	- Delivery Need: Allow an admin to provide a file, pasted text, or both, plus optional context instructions (for example period, association intent, and reconciliation notes) while retaining current job submission and review patterns.	- Delivered Outcome: Unify intake into file upload or pasted text with contextual notes completed in Intake Experience and Input Handling.	{"Execution Item: Unify intake into file upload or pasted text with contextual notes"}
1ebd77bc-7d19-4334-aee3-7e88997f6594	AI Ingestion Rebuild - Cross-Module Data Intake: Build ingestion-to-module routing matrix	Build ingestion-to-module routing matrix	Delivered in Module Routing and Import Execution. Define authoritative mapping from extracted record types to target modules (owners/persons/ownerships, invoices, financial accounts/ledger, documents/governance) with versioned routing rules.	Moves AI Ingestion Rebuild - Cross-Module Data Intake forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:eca1faff-44ea-45c3-8fe4-fe49baf3e23c	a5451dd1-b5a1-44a7-b936-f34232faf0e5	78091e86-1b8c-4ee7-8461-6b45d782f9f5	eca1faff-44ea-45c3-8fe4-fe49baf3e23c	2026-03-09 15:20:44.989	0	system	2026-03-09 15:56:00.417522	2026-03-09 16:02:52.811	- Delivery Need: Define authoritative mapping from extracted record types to target modules (owners/persons/ownerships, invoices, financial accounts/ledger, documents/governance) with versioned routing rules.	- Delivered Outcome: Build ingestion-to-module routing matrix completed in Module Routing and Import Execution.	{"Execution Item: Build ingestion-to-module routing matrix"}
2251d6c0-07c4-4d96-9632-ff40575da31a	Gap Closure M5 - Owner Portal and SaaS Tenancy: Gate owner portal rollout as future-expansion capability	Gate owner portal rollout as future-expansion capability	Delivered in SaaS Tenancy and Messaging. Implement feature-flagged rollout so owner portal aligns with FTPH future expansion scope and does not violate initial deployment assumptions.	Moves Gap Closure M5 - Owner Portal and SaaS Tenancy forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:91fc1f85-0f2f-41a6-852e-136520748d2b	bdcc5149-54c7-4b58-9581-e98ffaf685cc	f524059e-ad96-4080-8f1f-2e19f071789d	91fc1f85-0f2f-41a6-852e-136520748d2b	2026-03-07 18:23:12.773	0	system	2026-03-07 18:30:58.736768	2026-03-09 16:02:52.716	- Delivery Need: Implement feature-flagged rollout so owner portal aligns with FTPH future expansion scope and does not violate initial deployment assumptions.	- Delivered Outcome: Gate owner portal rollout as future-expansion capability completed in SaaS Tenancy and Messaging.	{"Execution Item: Gate owner portal rollout as future-expansion capability"}
b21fe5ef-7dd9-4e51-9420-a011a248ef0b	AI Ingestion Rebuild - Cross-Module Data Intake: Introduce explicit document classifier with confidence thresholds	Introduce explicit document classifier with confidence thresholds	Delivered in AI Extraction and Document Type Intelligence. Classify each submission into supported types such as owner/contact roster, invoice, bank statement, governance text, or unknown with score and explanation metadata.	Moves AI Ingestion Rebuild - Cross-Module Data Intake forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:57f26dcb-b722-4cc4-831c-9a4f0a396f83	a5451dd1-b5a1-44a7-b936-f34232faf0e5	88165f6f-dd3b-44af-bbf5-6b8008503d0e	57f26dcb-b722-4cc4-831c-9a4f0a396f83	2026-03-09 15:23:43.857	0	system	2026-03-09 15:56:00.366675	2026-03-09 16:02:52.75	- Delivery Need: Classify each submission into supported types such as owner/contact roster, invoice, bank statement, governance text, or unknown with score and explanation metadata.	- Delivered Outcome: Introduce explicit document classifier with confidence thresholds completed in AI Extraction and Document Type Intelligence.	{"Execution Item: Introduce explicit document classifier with confidence thresholds"}
2eac2418-0f50-4b3e-8e36-93953447c15b	AI Ingestion Rebuild - Cross-Module Data Intake: Create schema-specific extractors per document type	Create schema-specific extractors per document type	Delivered in AI Extraction and Document Type Intelligence. Enforce structured extraction contracts for each type so downstream import logic receives stable fields (for example owner identity fields, invoice line/amount/date, and transaction rows).	Moves AI Ingestion Rebuild - Cross-Module Data Intake forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:6ea7d0ff-9678-4e78-8ac1-47402924d891	a5451dd1-b5a1-44a7-b936-f34232faf0e5	88165f6f-dd3b-44af-bbf5-6b8008503d0e	6ea7d0ff-9678-4e78-8ac1-47402924d891	2026-03-09 15:20:44.989	0	system	2026-03-09 15:56:00.392565	2026-03-09 16:02:52.785	- Delivery Need: Enforce structured extraction contracts for each type so downstream import logic receives stable fields (for example owner identity fields, invoice line/amount/date, and transaction rows).	- Delivered Outcome: Create schema-specific extractors per document type completed in AI Extraction and Document Type Intelligence.	{"Execution Item: Create schema-specific extractors per document type"}
3d6bcfd3-d3c0-43e6-90d9-8f1cfe1eb667	AI Ingestion Rebuild - Cross-Module Data Intake: Add ingestion job preflight validation and actionable errors	Add ingestion job preflight validation and actionable errors	Delivered in Intake Experience and Input Handling. Validate required association context, source readability, and minimum content quality before processing. Return field-level error messages and remediation guidance.	Moves AI Ingestion Rebuild - Cross-Module Data Intake forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:a1437795-04ff-44e9-8edf-6474c61f32f7	a5451dd1-b5a1-44a7-b936-f34232faf0e5	e2aaa811-ca25-4894-8c8e-d6419e7227ac	a1437795-04ff-44e9-8edf-6474c61f32f7	2026-03-09 15:20:44.989	0	system	2026-03-09 15:56:00.396431	2026-03-09 16:02:52.79	- Delivery Need: Validate required association context, source readability, and minimum content quality before processing. Return field-level error messages and remediation guidance.	- Delivered Outcome: Add ingestion job preflight validation and actionable errors completed in Intake Experience and Input Handling.	{"Execution Item: Add ingestion job preflight validation and actionable errors"}
7ec866b8-770b-432a-99a6-6174fdfc6027	AI Ingestion Rebuild - Cross-Module Data Intake completed	AI Ingestion Rebuild - Cross-Module Data Intake reached 100%	Project completed with 15/15 roadmap tasks delivered (100%).	Creates a clean executive proof point for customer-facing progress and product maturity.	published	roadmap-project	slide:roadmap-project:a5451dd1-b5a1-44a7-b936-f34232faf0e5	a5451dd1-b5a1-44a7-b936-f34232faf0e5	\N	\N	2026-03-09 15:49:59.213	0	system	2026-03-09 16:02:43.753268	2026-03-09 16:02:52.819	- Program Goal: Complete AI Ingestion Rebuild - Cross-Module Data Intake with clear execution tracking.\n- Delivery Requirement: Close all planned roadmap tasks for this phase.	- Execution Result: AI Ingestion Rebuild - Cross-Module Data Intake is now complete.\n- Delivery Proof: 15 of 15 tasks are marked done (100%).	{"Delivered Item: Expand source parsing coverage for common admin artifacts","Delivered Item: Introduce explicit document classifier with confidence thresholds","Delivered Item: Capture import audit trail and provenance links","Delivered Item: Redesign review UI for record-level approve/edit/reject","Delivered Item: Create verification scripts for end-to-end ingestion scenarios","Delivered Item: Define ingestion accuracy benchmarks by document type","Delivered Item: Run staged rollout with monitoring and alerting","Delivered Item: Create schema-specific extractors per document type"}
4a6734f9-f062-46c8-8b10-001b338c72fb	AI Ingestion Rebuild - Cross-Module Data Intake: Add rollback and remediation tools for failed imports	Add rollback and remediation tools for failed imports	Delivered in Review Workflow, Auditability, and Recovery. Provide controlled rollback or compensating actions for failed/incorrect commits, including partial-failure reports and retry support.	Moves AI Ingestion Rebuild - Cross-Module Data Intake forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:e5d97f82-3c9f-4dad-bd7b-e6ee56d7857f	a5451dd1-b5a1-44a7-b936-f34232faf0e5	c7aa0a43-ddb8-4e06-bfc9-b66c32d28243	e5d97f82-3c9f-4dad-bd7b-e6ee56d7857f	2026-03-09 15:20:44.989	0	system	2026-03-09 15:56:00.404899	2026-03-09 16:02:52.798	- Delivery Need: Provide controlled rollback or compensating actions for failed/incorrect commits, including partial-failure reports and retry support.	- Delivered Outcome: Add rollback and remediation tools for failed imports completed in Review Workflow, Auditability, and Recovery.	{"Execution Item: Add rollback and remediation tools for failed imports"}
750f2c26-3f73-4217-b61e-362d9ac35e6c	AI Ingestion Rebuild - Cross-Module Data Intake: Add duplicate detection and smart matching	Add duplicate detection and smart matching	Delivered in Module Routing and Import Execution. Match existing entities by normalized keys and fuzzy checks (unit, name, email, invoice reference, transaction amount/date) to reduce duplicate records and wrong module inserts.	Moves AI Ingestion Rebuild - Cross-Module Data Intake forward with a completed, production-tracked deliverable.	draft	roadmap-task	roadmap-task:3a83a9f2-21d1-4253-9d71-458bed413599	a5451dd1-b5a1-44a7-b936-f34232faf0e5	78091e86-1b8c-4ee7-8461-6b45d782f9f5	3a83a9f2-21d1-4253-9d71-458bed413599	2026-03-09 15:20:44.989	0	system	2026-03-09 15:56:00.42159	2026-03-09 16:02:52.815	- Delivery Need: Match existing entities by normalized keys and fuzzy checks (unit, name, email, invoice reference, transaction amount/date) to reduce duplicate records and wrong module inserts.	- Delivered Outcome: Add duplicate detection and smart matching completed in Module Routing and Import Execution.	{"Execution Item: Add duplicate detection and smart matching"}
303af857-d288-4590-80fd-5af4b0ac9d9b	Communications, Onboarding, and Resident Data Foundation - 2026-03-11 completed	Communications, Onboarding, and Resident Data Foundation - 2026-03-11 reached 100%	Project completed with 21/21 roadmap tasks delivered (100%).	Creates a clean executive proof point for customer-facing progress and product maturity.	published	roadmap-project	slide:roadmap-project:4ae90483-27e3-46a6-8c5f-56d57669618a	4ae90483-27e3-46a6-8c5f-56d57669618a	\N	\N	2026-03-11 14:06:12.702	0	system	2026-03-11 22:25:53.544527	2026-03-11 22:25:53.871	- Program Goal: Complete Communications, Onboarding, and Resident Data Foundation - 2026-03-11 with clear execution tracking.\n- Delivery Requirement: Close all planned roadmap tasks for this phase.	- Execution Result: Communications, Onboarding, and Resident Data Foundation - 2026-03-11 is now complete.\n- Delivery Proof: 21 of 21 tasks are marked done (100%).	{"Delivered Item: Implement onboarding completeness scoring and progress bar","Delivered Item: Define maintenance request schema with attachments and routing metadata","Delivered Item: Define onboarding state machine and reopen/remediation workflow","Delivered Item: Define event-driven notification scheduler and milestone reminder rules","Delivered Item: Create association overview dashboard with key metrics and quick actions","Delivered Item: Implement bidirectional communications service for outbound and inbound flows","Delivered Item: Build owner and tenant onboarding forms with occupancy-conditional logic","Delivered Item: Add association-level contact data quality checks and completion gates"}
74344448-fa21-4109-ae53-e8f689f80a61	Active Project - Association-Scoped Board Member Access completed	Active Project - Association-Scoped Board Member Access reached 100%	Project completed with 12/12 roadmap tasks delivered (100%).	Creates a clean executive proof point for customer-facing progress and product maturity.	published	roadmap-project	slide:roadmap-project:d5c23cf5-75c5-4823-9e93-afd849dd150a	d5c23cf5-75c5-4823-9e93-afd849dd150a	\N	\N	2026-03-15 13:03:05.276	0	system	2026-03-15 13:03:20.266223	2026-03-15 13:03:20.264	- Program Goal: Complete Active Project - Association-Scoped Board Member Access with clear execution tracking.\n- Delivery Requirement: Close all planned roadmap tasks for this phase.	- Execution Result: Active Project - Association-Scoped Board Member Access is now complete.\n- Delivery Proof: 12 of 12 tasks are marked done (100%).	{"Delivered Item: Add board-member access role and lifecycle fields","Delivered Item: Link board-member access grants to board service and association scope","Delivered Item: Build admin board-member invite flow","Delivered Item: Implement invite acceptance and activation rules","Delivered Item: Preserve owner self-service access when board service ends","Delivered Item: Resolve combined owner and board-member permissions under one identity","Delivered Item: Run end-to-end verification for board-member scope boundaries","Delivered Item: Audit log board-member invite lifecycle and write actions"}
316a1d78-7ab6-41e0-bb8d-43133cf48612	FTPH Follow-On Phase - Vendor, Maintenance, and Property Operations completed	FTPH Follow-On Phase - Vendor, Maintenance, and Property Operations reached 100%	Project completed with 20/20 roadmap tasks delivered (100%).	Creates a clean executive proof point for customer-facing progress and product maturity.	published	roadmap-project	slide:roadmap-project:91b9fef3-9fd7-418e-b306-6fb0c6118b9a	91b9fef3-9fd7-418e-b306-6fb0c6118b9a	\N	\N	2026-03-14 14:50:51.186	0	system	2026-03-15 13:03:38.36808	2026-03-15 13:03:38.367	- Program Goal: Complete FTPH Follow-On Phase - Vendor, Maintenance, and Property Operations with clear execution tracking.\n- Delivery Requirement: Close all planned roadmap tasks for this phase.	- Execution Result: FTPH Follow-On Phase - Vendor, Maintenance, and Property Operations is now complete.\n- Delivery Proof: 20 of 20 tasks are marked done (100%).	{"Delivered Item: Upgrade portal maintenance submission with categories, urgency, and photo evidence","Delivered Item: Connect vendor records to invoices and future work orders","Delivered Item: Link completed work orders to vendor invoices and expenses","Delivered Item: Link vendor documents, insurance certificates, and contracts","Delivered Item: Add inspection records with findings, photos, and severity","Delivered Item: Convert inspection findings into follow-up work orders","Delivered Item: Create preventive maintenance templates and schedule generation","Delivered Item: Create operations dashboard for open work, aging, and vendor activity"}
963dbb72-5b33-43d7-9b4a-c67f53c961f1	Admin Roadmap Backbone - Agent Bootstrap and Continuous Improvement completed	Admin Roadmap Backbone - Agent Bootstrap and Continuous Improvement reached 100%	Project completed with 12/12 roadmap tasks delivered (100%).	Creates a clean executive proof point for customer-facing progress and product maturity.	published	roadmap-project	slide:roadmap-project:f4d97ef5-810b-41d2-a380-a356781cb8a8	f4d97ef5-810b-41d2-a380-a356781cb8a8	\N	\N	2026-03-15 14:30:28.688	0	system	2026-03-15 14:42:40.78528	2026-03-15 14:42:40.783	- Program Goal: Complete Admin Roadmap Backbone - Agent Bootstrap and Continuous Improvement with clear execution tracking.\n- Delivery Requirement: Close all planned roadmap tasks for this phase.	- Execution Result: Admin Roadmap Backbone - Agent Bootstrap and Continuous Improvement is now complete.\n- Delivery Proof: 12 of 12 tasks are marked done (100%).	{"Delivered Item: Create machine-readable workspace bootstrap manifest","Delivered Item: Define success metrics for reduced startup and rediscovery cost","Delivered Item: Adopt agent bootstrap backbone in admin roadmap planning standard","Delivered Item: Add refresh rules for manifest drift detection","Delivered Item: Expose active roadmap context in bootstrap output","Delivered Item: Define durable memory format for stable repo facts","Delivered Item: Store repeatable setup knowledge separately from transient task notes","Delivered Item: Add verification command memory for common change types"}
3592bebe-e149-4013-9e99-b585f96ea267	Active Project - Board Workspace Service Journey and Implementation Backbone completed	Active Project - Board Workspace Service Journey and Implementation Backbone reached 100%	Project completed with 14/14 roadmap tasks delivered (100%).	Creates a clean executive proof point for customer-facing progress and product maturity.	published	roadmap-project	slide:roadmap-project:ff940b75-154f-4b87-810a-70ebf9436de2	ff940b75-154f-4b87-810a-70ebf9436de2	\N	\N	2026-03-15 13:43:13.837	0	system	2026-03-15 14:52:47.784735	2026-03-15 14:53:29.175	- Program Goal: Complete Active Project - Board Workspace Service Journey and Implementation Backbone with clear execution tracking.\n- Delivery Requirement: Close all planned roadmap tasks for this phase.	- Execution Result: Active Project - Board Workspace Service Journey and Implementation Backbone is now complete.\n- Delivery Proof: 14 of 14 tasks are marked done (100%).	{"Delivered Item: Document board self-service workspace operating model","Delivered Item: Capture current-state board workspace journey review","Delivered Item: Translate journey findings into service opportunities","Delivered Item: Record direct-write board authority and association scope rules","Delivered Item: Define activity and state as essential product requirements","Delivered Item: Plan governance task and meeting management chunk","Delivered Item: Define plan-first then implement-next roadmap workflow","Delivered Item: Plan communications and document-publishing chunk"}
\.


--
-- Data for Name: admin_roadmap_projects; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.admin_roadmap_projects (id, title, description, status, is_collapsed, created_at, updated_at) FROM stdin;
7e5b4164-9714-412b-91a2-14ff5c5b55d6	Active Project - Google OAuth Sign-In (Session-Based)	Implement backend-managed Google OAuth 2.0 login with durable server sessions, account linking, session recovery fallback, and post-login workspace bootstrap.	archived	1	2026-03-12 17:56:53.749437	2026-03-15 14:53:38.654
cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	Phase 1 - Foundation, Registry, and Core Admin	Platform foundation and system of record for associations, units, people, occupancy, board roles, and documents.	archived	1	2026-03-06 17:13:38.160648	2026-03-07 21:04:31.122
8bc174fd-d350-4f41-833f-fc641200ec55	Phase 2 - Financial Operations and Budget Control	Accounting operations for dues, assessments, payments, expenses, utilities, and budgets.	archived	1	2026-03-06 17:13:38.160648	2026-03-07 21:04:32.294
97747fa0-40e2-4113-b6e6-dba6e033eae4	Phase 3 - Governance, Meetings, and Compliance Operations	Operational governance records for meetings, decisions, annual obligations, and recurring tasks.	archived	1	2026-03-06 17:13:38.160648	2026-03-07 21:04:33.437
b1376498-d4d1-4400-ac8b-3b5a2ce6aea0	Phase 4 - Document Intelligence, Intake, and Operational Scale	AI-assisted document ingestion, metadata extraction, review workflow, and linkage foundation.	archived	1	2026-03-06 17:13:38.160648	2026-03-07 21:04:34.312
567fd831-d3fb-4867-8565-1609e8bea1c2	Phase 5 - Portals, Communications, and SaaS Expansion	External-facing access, communications, and multi-association expansion architecture.	archived	1	2026-03-06 17:13:38.160648	2026-03-07 21:04:35.255
38b68bc4-7837-448e-981f-bcd55aca5bef	Active Project - Association Onboarding Contact Intake and Unit-Linked Signup	Create onboarding flows for associations that start with no resident contacts, covering manual admin entry, outreach to existing contact data, unit-bound owner and tenant signup links, review and approval, and portal activation into the correct association and unit.	archived	1	2026-03-14 14:45:38.468207	2026-03-15 14:53:27.885
9efff677-7938-4f3f-8580-2bff3e3765c2	Executive Highlights & Defend Logs	Admin module for concise executive delivery highlights and defensible evidence logs, with roadmap-completion sync.	archived	1	2026-03-07 16:12:06.204632	2026-03-07 21:04:23.985
a62be175-0e65-4048-b1f3-4ed3dd75339a	FTPH Next Phase - Payment Processing and Financial Automation	Close the biggest remaining FTPH gap by converting the current payment foundation into a production-ready financial operations layer with live collection, autopay, delinquency controls, reconciliation, and board-ready reporting.	active	1	2026-03-14 12:59:58.045206	2026-03-15 14:53:58.035
3ae27457-bc53-46e5-8b09-e752623c97aa	Gap Closure M4 - Bylaw Clause Intelligence	Close Milestone 4 bylaw intelligence gaps: clause-level structured extraction, tagging, and suggested entity linkage.	archived	1	2026-03-07 17:28:28.028957	2026-03-09 16:59:40.47
25833155-96ba-4795-a8fe-3cb30d6870d8	Phase 6 - Ingestion Engine Fortification and Trust	Follow-on phase to reopen the ingestion initiative with deterministic normalization, platform-context routing, strong quality gates, and measurable trust before import.	active	1	2026-03-09 16:54:41.198391	2026-03-11 17:51:28.418
e6c8ac97-a9a0-452a-85e9-2dbc332a5b3f	Foundation Follow-up Operations - 2026-03-11	Post-delivery cleanup and operational hardening tasks for communications/onboarding foundation.	archived	0	2026-03-11 14:18:20.853403	2026-03-14 13:30:04.972
c9a3eb98-e4da-4d17-bac9-b3a4329ed363	Gap Closure M3 - Governance Depth (Resolutions, Votes, Calendar)	Close Milestone 3 governance depth gaps: agenda items, notes, resolutions, vote records, and calendar event modeling.	archived	1	2026-03-07 17:28:27.919174	2026-03-09 16:59:44.491
fffb518f-1d5f-4ed1-8a3d-8eb036a1fde1	Gap Closure M2 - Budget Domain and Variance Controls	Close Milestone 2 budget gaps: budget entities, version lifecycle, ratification workflow, and budget-vs-actual reporting.	archived	1	2026-03-07 17:28:27.818191	2026-03-09 16:59:48.398
d869e3c4-d366-44f9-83e6-b6da45e24b80	Gap Closure M1 - Audit Logging and Delete Controls	Close Milestone 1 gaps: full CRUD auditability, explicit delete workflows, and tamper-resistant action history across core registry entities.	archived	1	2026-03-07 17:28:27.421035	2026-03-09 16:59:53.393
bdcc5149-54c7-4b58-9581-e98ffaf685cc	Gap Closure M5 - Owner Portal and SaaS Tenancy	Close Milestone 5 productization gaps: owner-facing portal access, membership model, tenant config, and email-thread visibility.	archived	1	2026-03-07 17:28:28.092888	2026-03-09 17:00:03.442
a5451dd1-b5a1-44a7-b936-f34232faf0e5	AI Ingestion Rebuild - Cross-Module Data Intake	Evolve the current AI ingestion foundation in-place: keep job/review/governance scaffolding, replace extraction and module-routing internals, and add robust cross-module import for owners, contacts, invoices, bank statements, and related data.	archived	1	2026-03-09 14:19:51.566225	2026-03-15 14:53:20.328
ff940b75-154f-4b87-810a-70ebf9436de2	Active Project - Board Workspace Service Journey and Implementation Backbone	Capture the board self-service workspace findings in full, structure the implementation plan thoroughly, and codify a repeatable review-first, implement-next roadmap rhythm for future service-oriented projects.	archived	1	2026-03-15 13:13:49.563607	2026-03-17 01:49:39.315
130614dc-fe17-427c-bc29-dd957cf3c797	FTPH Phase 8 - Advanced Reporting, Analytics, and Compliance Intelligence	Stage the next post-operations phase from the FTPH documentation: board reporting automation, financial analytics, AI compliance monitoring, state-specific compliance templates, and cross-association benchmarking.	active	0	2026-03-14 14:52:01.711851	2026-03-17 11:56:41.151
d15814d0-848b-4513-9236-82b1755faa7b	Active Project - Building-First Unit Onboarding	Shift unit onboarding to a building-first workflow: create/select building with address and capacity metadata before unit creation, while preserving existing enhancements.	archived	1	2026-03-12 16:20:06.976649	2026-03-15 14:53:35.497
4ae90483-27e3-46a6-8c5f-56d57669618a	Communications, Onboarding, and Resident Data Foundation - 2026-03-11	Structured implementation project derived from exploratory findings across communications architecture, resident data modeling, onboarding workflows, and payment instruction automation.	archived	1	2026-03-11 13:10:05.238038	2026-03-15 14:53:17.649
e1bbe890-04bd-4448-bed8-beb513dfb2bd	Platform Gap Analysis - 2026-03-07	Findings from a full end-to-end verification pass across admin, financial, governance, AI ingestion, communications, platform controls, and owner portal workflows.	active	0	2026-03-07 21:55:08.335886	2026-03-17 03:04:55.449
d5c23cf5-75c5-4823-9e93-afd849dd150a	Active Project - Association-Scoped Board Member Access	Deliver invited board-member workspace access with association-scoped permissions, combined owner-plus-board identity resolution, and audit-safe lifecycle controls.	archived	1	2026-03-15 12:40:52.851269	2026-03-15 14:53:30.392
91b9fef3-9fd7-418e-b306-6fb0c6118b9a	FTPH Follow-On Phase - Vendor, Maintenance, and Property Operations	Follow the payment-automation phase with the missing property-operations layer: vendor registry, work orders, maintenance workflows, preventive scheduling, inspections, and operating controls.	archived	1	2026-03-14 13:02:29.954076	2026-03-15 14:53:14.945
afd38fb0-c594-4b57-8151-397146ab973d	UI/UX Audit — Property Manager & Self-Managed Association	End-to-end findings from a full UI audit conducted from two distinct user perspectives: (1) a professional property manager overseeing multiple associations, and (2) a volunteer board member running a self-managed HOA. Tasks are organized by product area and prioritized by adoption impact.	active	0	2026-03-17 01:44:01.573263	2026-03-17 02:57:20.276
9287c136-759b-432b-b82d-2ffa8d7ef695	Platform-wide UI and UX Opportunity Analysis	Analysis captured on 2026-03-15 across the app shell, admin workspace, operations, finance, governance, documents, onboarding, and owner portal. Key themes: weak wayfinding across a large route surface, dense unsorted tables, inconsistent loading and error feedback, context-heavy forms, and limited mobile-ready handling for operational workflows.	archived	0	2026-03-15 13:23:08.196155	2026-03-15 14:53:04.607
f4d97ef5-810b-41d2-a380-a356781cb8a8	Admin Roadmap Backbone - Agent Bootstrap and Continuous Improvement	Reduce repeated agent setup work by creating a reusable bootstrap layer, durable working memory, friction logging, and closed-loop roadmap updates so future agent interactions start with more context and less rediscovery.	archived	1	2026-03-15 13:26:42.067402	2026-03-15 14:53:40.806
8f6d2c2e-dc9c-4481-857e-e7bcbb195911	FTPH Backlog Closure - Inactive and Partial Feature Delivery	Cross-phase implementation plan for FTPH backlog items currently marked inactive or partial in the feature tree. AI ingestion is now largely delivered; active execution focus has shifted to resident intake, communications routing, managed regulatory records, governance automation, owner experience, and platform expansion backlog branches.	active	1	2026-03-15 12:39:13.10575	2026-03-15 14:53:52.727
b6c2d9d5-3780-496f-b957-0a6b2da15da6	Condo Workflow Reliability and Data Integrity Recovery	Recovery roadmap created from exploratory testing findings across authentication, association context, owner onboarding, residential data integrity, and communications workflows.	active	1	2026-03-16 14:06:37.441162	2026-03-17 01:39:25.987
\.


--
-- Data for Name: admin_roadmap_tasks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.admin_roadmap_tasks (id, project_id, workstream_id, title, description, status, effort, priority, dependency_task_ids, target_start_date, target_end_date, completed_date, created_at, updated_at) FROM stdin;
ac335eb0-3477-4210-9c32-ca6dae7e2eeb	4ae90483-27e3-46a6-8c5f-56d57669618a	fcc1380e-4f9e-41ba-8dc9-9ac84c23802f	Implement onboarding completeness scoring and progress bar	Track setup milestones across units, owners, tenants, contacts, payment setup, and communications readiness with weighted progress. (ISS-006)	done	medium	medium	{6151e61d-b460-46be-a5e3-e564ac7b44c9,0643c8a3-b9a0-4c13-a120-89fe0242806c}	2026-04-27 00:00:00	2026-05-10 00:00:00	2026-03-11 14:06:12.648	2026-03-11 13:10:05.455149	2026-03-11 14:06:12.648
e98b540d-bd02-4314-b621-96cf0d7b94e5	4ae90483-27e3-46a6-8c5f-56d57669618a	d5abf9a7-9a40-4680-a3a9-6b39d1bb69de	Define maintenance request schema with attachments and routing metadata	Capture requester, location, category, severity, description, and photo attachments with validation and storage strategy. (ISS-003)	done	medium	high	{}	2026-03-16 00:00:00	2026-03-29 00:00:00	2026-03-11 13:34:34.975	2026-03-11 13:10:05.468702	2026-03-11 14:06:12.665
6151e61d-b460-46be-a5e3-e564ac7b44c9	4ae90483-27e3-46a6-8c5f-56d57669618a	fcc1380e-4f9e-41ba-8dc9-9ac84c23802f	Define onboarding state machine and reopen/remediation workflow	Formalize statuses (not started, in progress, blocked, complete) with explicit blockers and remediation assignments.	done	small	medium	{}	2026-03-16 00:00:00	2026-03-29 00:00:00	2026-03-11 14:06:12.609	2026-03-11 13:10:05.462129	2026-03-11 14:06:12.609
62d3370a-1f36-42c8-8782-15c24c8c46e3	4ae90483-27e3-46a6-8c5f-56d57669618a	e5cf2ca5-ad7f-48b1-a6ce-dcda777a150f	Define event-driven notification scheduler and milestone reminder rules	Implement configurable reminder intervals (for example 14-day pre-milestone notices) with association-level enablement and auditable send history. (ISS-001)	done	large	high	{1986cc94-1da9-47cc-9e22-7d13ba656917,3fc2b8b6-ef45-4fd8-aa8f-8d28850eb275}	2026-04-13 00:00:00	2026-04-26 00:00:00	2026-03-11 14:06:12.668	2026-03-11 13:10:05.40843	2026-03-11 14:06:12.668
ad74e7b1-3031-4ff2-8bb3-1dc1835289c6	4ae90483-27e3-46a6-8c5f-56d57669618a	fcc1380e-4f9e-41ba-8dc9-9ac84c23802f	Create association overview dashboard with key metrics and quick actions	Build a centralized association page aggregating onboarding status, communications readiness, data quality, and operational shortcuts. (ISS-007)	done	medium	medium	{ac335eb0-3477-4210-9c32-ca6dae7e2eeb}	2026-05-11 00:00:00	2026-05-24 00:00:00	2026-03-11 14:06:12.672	2026-03-11 13:10:05.458716	2026-03-11 14:06:12.672
1986cc94-1da9-47cc-9e22-7d13ba656917	4ae90483-27e3-46a6-8c5f-56d57669618a	e5cf2ca5-ad7f-48b1-a6ce-dcda777a150f	Implement bidirectional communications service for outbound and inbound flows	Support outbound notices plus inbound resident submissions through a unified message routing layer with thread context and role-based access. (ISS-002)	done	large	high	{3fc2b8b6-ef45-4fd8-aa8f-8d28850eb275,59ac98f4-e15e-4d19-9afc-520d9a8ed790}	2026-03-30 00:00:00	2026-04-12 00:00:00	2026-03-11 14:06:12.676	2026-03-11 13:10:05.414855	2026-03-11 14:06:12.676
1960cdc9-3940-4da2-b5c7-2cadf670d708	4ae90483-27e3-46a6-8c5f-56d57669618a	3757aa94-7f05-46ae-ba8d-2c06a7eacb04	Build owner and tenant onboarding forms with occupancy-conditional logic	Create structured forms for owner-occupied vs rental units with required-field validation and lifecycle state tracking. (ISS-005)	done	medium	high	{f0e8ccec-34ef-4e28-80a1-245c9f90fd86,6151e61d-b460-46be-a5e3-e564ac7b44c9}	2026-03-30 00:00:00	2026-04-12 00:00:00	2026-03-11 14:06:12.679	2026-03-11 13:10:05.443277	2026-03-11 14:06:12.679
0643c8a3-b9a0-4c13-a120-89fe0242806c	4ae90483-27e3-46a6-8c5f-56d57669618a	3757aa94-7f05-46ae-ba8d-2c06a7eacb04	Add association-level contact data quality checks and completion gates	Block key communications workflows when required contact fields are incomplete and provide actionable validation errors to admins.	done	medium	medium	{1960cdc9-3940-4da2-b5c7-2cadf670d708,6d93383d-1746-47a1-9488-0b1f26bbd02f}	2026-04-13 00:00:00	2026-04-26 00:00:00	2026-03-11 13:30:27.488	2026-03-11 13:10:05.447265	2026-03-11 14:06:12.683
6d93383d-1746-47a1-9488-0b1f26bbd02f	4ae90483-27e3-46a6-8c5f-56d57669618a	e5cf2ca5-ad7f-48b1-a6ce-dcda777a150f	Create recipient targeting engine by role and occupancy state	Encode delivery logic for occupants, owners, and CC rules, including fallback handling for missing contacts and per-message audience preview. (ISS-010)	done	large	high	{f0e8ccec-34ef-4e28-80a1-245c9f90fd86,1986cc94-1da9-47cc-9e22-7d13ba656917}	2026-04-13 00:00:00	2026-04-26 00:00:00	2026-03-11 13:30:27.44	2026-03-11 13:10:05.431523	2026-03-11 14:06:12.686
2abe0f36-45af-4158-bde9-fa802350433c	4ae90483-27e3-46a6-8c5f-56d57669618a	d5abf9a7-9a40-4680-a3a9-6b39d1bb69de	Implement maintenance submission intake pipeline and ticket creation	Accept inbound requests through resident channels, generate work items, assign queues, and trigger status notifications.	done	large	high	{e98b540d-bd02-4314-b621-96cf0d7b94e5,1986cc94-1da9-47cc-9e22-7d13ba656917}	2026-03-30 00:00:00	2026-04-12 00:00:00	2026-03-11 13:34:34.971	2026-03-11 13:10:05.47216	2026-03-11 14:06:12.689
6db6297a-2ef5-458a-9e30-ef31c41fa4eb	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	bd60a4ad-56b6-4f35-af7f-de0d57c1904f	1.2.2 Link Owner to Unit	Persist ownership links between people and units.	done	small	high	{2a0ccb83-9303-4fde-96a2-7c9c4087e5ed,e5363ecd-5fbb-4b81-b494-b81295f2e4a2}	2026-03-01 00:00:00	2026-03-06 00:00:00	2026-03-06 18:23:07.195	2026-03-06 17:33:32.210021	2026-03-06 18:23:07.195
3fc2b8b6-ef45-4fd8-aa8f-8d28850eb275	4ae90483-27e3-46a6-8c5f-56d57669618a	e5cf2ca5-ad7f-48b1-a6ce-dcda777a150f	Build template management with standard header/footer and merge fields	Create reusable communication templates with placeholder validation, association overrides, and versioning for governance control. (ISS-008)	done	medium	high	{}	2026-03-16 00:00:00	2026-03-29 00:00:00	2026-03-11 14:06:12.692	2026-03-11 13:10:05.427411	2026-03-11 14:06:12.692
f0e8ccec-34ef-4e28-80a1-245c9f90fd86	4ae90483-27e3-46a6-8c5f-56d57669618a	3757aa94-7f05-46ae-ba8d-2c06a7eacb04	Implement normalized resident contact schema with multi-occupant support	Add data model and validation for phone/email/contact preference with multiple tenants per unit and owner-to-occupant relationship linkage. (ISS-004)	done	large	high	{}	2026-03-16 00:00:00	2026-03-29 00:00:00	2026-03-11 14:06:12.696	2026-03-11 13:10:05.439671	2026-03-11 14:06:12.696
247ca0df-f661-4256-89f3-305da5ec7ab5	4ae90483-27e3-46a6-8c5f-56d57669618a	d5abf9a7-9a40-4680-a3a9-6b39d1bb69de	Build payment method configuration registry per association	Store accepted methods, processing instructions, and support contacts in a normalized configuration model tied to financial settings. (ISS-009)	done	medium	medium	{}	2026-03-16 00:00:00	2026-03-29 00:00:00	2026-03-11 14:00:08.489	2026-03-11 13:10:05.475772	2026-03-11 14:06:12.698
262d5811-a660-47ba-aebc-26a76e8b20b9	97747fa0-40e2-4113-b6e6-dba6e033eae4	e48312ae-b030-40c2-8c15-8d4de6aa540d	5.1.1 Schedule Meeting Record	Create and manage meeting records with date/type/status.	done	medium	high	{}	2026-05-15 00:00:00	2026-05-30 00:00:00	2026-03-06 20:50:48.156	2026-03-06 17:33:32.292258	2026-03-06 20:58:23.291
b7a2237b-d235-4ae5-b8c3-8d37f86fdeea	97747fa0-40e2-4113-b6e6-dba6e033eae4	4bca35a2-0673-4ff8-9975-1bdfde9c7e2d	5.1.2 Record Meeting Notes	Capture meeting notes/minutes and attachments.	done	medium	high	{262d5811-a660-47ba-aebc-26a76e8b20b9}	2026-05-25 00:00:00	2026-06-10 00:00:00	2026-03-06 20:58:23.325	2026-03-06 17:33:32.295866	2026-03-06 20:58:23.325
d65a0696-6233-4154-8e12-e1ced587b0ef	7e5b4164-9714-412b-91a2-14ff5c5b55d6	037a31b4-ff27-434a-9d19-3ef8fd273432	Create internal user identity model and external account-link table	Add internal app user table plus OAuth account-link table keyed by provider + providerAccountId, keeping email as secondary linking key for migration.	done	large	critical	{}	\N	\N	2026-03-12 18:06:53.903	2026-03-12 17:56:54.048765	2026-03-12 18:06:53.903
cb9d4c54-2263-4570-8b06-a4330372f53f	97747fa0-40e2-4113-b6e6-dba6e033eae4	977deeb0-def2-4626-bbd6-87aa1af7c651	5.1.3 Publish Meeting Summary	Generate and expose approved meeting summary for governance review.	done	small	medium	{b7a2237b-d235-4ae5-b8c3-8d37f86fdeea}	2026-06-08 00:00:00	2026-06-20 00:00:00	2026-03-06 20:58:23.343	2026-03-06 17:33:32.299874	2026-03-06 20:58:23.343
146f7f22-0b40-47c8-8251-3cc75348598d	b1376498-d4d1-4400-ac8b-3b5a2ce6aea0	84775f80-73cf-441d-8e88-ef41be318894	4.2.1 Upload Raw Document for Parsing	Support raw file upload path into AI parsing pipeline.	done	large	high	{}	2026-07-15 00:00:00	2026-08-05 00:00:00	2026-03-06 21:13:41.044	2026-03-06 17:33:32.3167	2026-03-06 21:13:41.044
c4e4f424-c225-4e56-95c6-dbd14467c76f	567fd831-d3fb-4867-8565-1609e8bea1c2	ec8ea352-58d6-4a75-9875-fa7c7c3a6d7e	Platform: Future Self-Service Permission Envelope	Define permission envelope for future owner/tenant self-service roles without exposing internal admin operations.	done	medium	medium	{692c3d0a-2a2c-4c50-9a49-6acbfb82fdc4,9b5807b6-2847-42e8-b297-bd640b48e5d8}	2026-10-05 00:00:00	2026-10-25 00:00:00	2026-03-06 21:20:59.766	2026-03-06 17:43:50.533219	2026-03-06 21:20:59.766
8d00ce23-38ca-4e1e-ab67-a33984499f8e	4ae90483-27e3-46a6-8c5f-56d57669618a	3757aa94-7f05-46ae-ba8d-2c06a7eacb04	Separate emergency contact fields from primary occupant contact records	Add dedicated emergency contact capture and routing flags to avoid conflating emergency and routine communication targets. (FTPH 1.3 Open Question)	done	small	medium	{f0e8ccec-34ef-4e28-80a1-245c9f90fd86}	2026-03-30 00:00:00	2026-04-12 00:00:00	2026-03-11 14:06:12.702	2026-03-11 13:12:27.242345	2026-03-11 14:06:12.702
18dd6574-e9ba-4e39-922c-41ffc6266284	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	9a954185-9d87-4874-a96f-adbd366616d9	2.1.3 Track Board Service History	Preserve board service timeline history for governance records.	done	small	medium	{8a3fe6ae-1be2-4caf-9ceb-02b9cc50ada4}	2026-03-01 00:00:00	2026-03-06 00:00:00	2026-03-06 18:23:07.336	2026-03-06 17:33:32.238588	2026-03-06 18:23:07.336
4525606c-93d1-4a36-9356-f299149e9ecd	97747fa0-40e2-4113-b6e6-dba6e033eae4	2f98b4ba-ee22-4b73-a997-0d14a4716d9d	Governance: Kanban/Workstream Task Visibility	Expose governance checklist tasks via Kanban/workstream views for operational execution tracking.	done	medium	medium	{025f2027-0bce-4e08-b4d0-28ff19c51228}	2026-06-16 00:00:00	2026-06-30 00:00:00	2026-03-06 20:58:23.346	2026-03-06 17:43:50.501694	2026-03-06 20:58:23.346
e5f2283b-079e-4550-adb9-128e3fa974e8	97747fa0-40e2-4113-b6e6-dba6e033eae4	e48312ae-b030-40c2-8c15-8d4de6aa540d	Governance: Budget Meeting Support Workflow	Support budget-meeting-specific scheduling metadata and linkage to annual checklist obligations.	done	small	medium	{262d5811-a660-47ba-aebc-26a76e8b20b9,0952f3fc-2bb1-41b5-a89f-2d8661fb2a28}	2026-06-05 00:00:00	2026-06-16 00:00:00	2026-03-06 20:58:23.329	2026-03-06 17:43:50.497296	2026-03-06 20:58:23.329
6b1ddc56-f6d2-4f63-ad53-3652411d350e	4ae90483-27e3-46a6-8c5f-56d57669618a	3757aa94-7f05-46ae-ba8d-2c06a7eacb04	Implement owner-submitted tenant update review and approval queue	Introduce moderation workflow so owner-submitted occupant changes can be reviewed and approved before becoming active records. (FTPH 1.3 Open Question)	done	medium	medium	{1960cdc9-3940-4da2-b5c7-2cadf670d708}	2026-04-13 00:00:00	2026-04-26 00:00:00	2026-03-11 13:30:27.504	2026-03-11 13:12:27.23856	2026-03-11 14:06:12.705
29e674fc-9d52-420f-a8db-e478b875c9ed	4ae90483-27e3-46a6-8c5f-56d57669618a	e5cf2ca5-ad7f-48b1-a6ce-dcda777a150f	Add send preview and approval workflow before dispatch	Require optional approval checkpoints for selected notice types before emails are sent, with approver audit trail and override notes. (FTPH 7.1 Open Question)	done	small	medium	{3fc2b8b6-ef45-4fd8-aa8f-8d28850eb275,1986cc94-1da9-47cc-9e22-7d13ba656917}	2026-04-13 00:00:00	2026-04-26 00:00:00	2026-03-11 13:30:27.508	2026-03-11 13:12:27.215722	2026-03-11 14:06:12.708
77cd5886-f8eb-4207-b24a-467ffc490569	4ae90483-27e3-46a6-8c5f-56d57669618a	d5abf9a7-9a40-4680-a3a9-6b39d1bb69de	Add submitter-facing maintenance request history and status timeline	Expose request history for owners/tenants with status progression and latest updates to reduce duplicate submissions and support transparency. (FTPH 7.3.4)	done	medium	medium	{2abe0f36-45af-4158-bde9-fa802350433c}	2026-04-13 00:00:00	2026-04-26 00:00:00	2026-03-11 13:34:34.978	2026-03-11 13:12:27.274104	2026-03-11 14:06:12.711
025f2027-0bce-4e08-b4d0-28ff19c51228	97747fa0-40e2-4113-b6e6-dba6e033eae4	2f98b4ba-ee22-4b73-a997-0d14a4716d9d	6.1.2 Track Task Completion	Track completion state transitions for annual compliance tasks.	done	medium	high	{0952f3fc-2bb1-41b5-a89f-2d8661fb2a28}	2026-06-12 00:00:00	2026-06-28 00:00:00	2026-03-06 20:58:23.35	2026-03-06 17:33:32.308765	2026-03-06 20:58:23.35
6de9a9ad-1de8-4019-b0e6-0ff9d3ef6877	97747fa0-40e2-4113-b6e6-dba6e033eae4	977deeb0-def2-4626-bbd6-87aa1af7c651	6.1.3 Display Compliance Dashboard	Provide governance dashboard with deadlines, open tasks, and completion.	done	medium	medium	{025f2027-0bce-4e08-b4d0-28ff19c51228}	2026-06-22 00:00:00	2026-07-08 00:00:00	2026-03-06 20:58:23.333	2026-03-06 17:33:32.312658	2026-03-06 20:58:23.333
0952f3fc-2bb1-41b5-a89f-2d8661fb2a28	97747fa0-40e2-4113-b6e6-dba6e033eae4	769aa68c-a3ab-4623-a92e-79d176cad1b3	6.1.1 Create Annual Governance Tasks	Generate annual governance checklist tasks and due dates.	done	medium	high	{}	2026-06-01 00:00:00	2026-06-18 00:00:00	2026-03-06 20:50:48.162	2026-03-06 17:33:32.304844	2026-03-06 20:58:23.336
4d26e349-f0bb-4ad5-a7cf-2d205987176d	b1376498-d4d1-4400-ac8b-3b5a2ce6aea0	4e2f4861-99c6-4ffa-ab7c-7254b844909d	4.2.2 Extract Document Metadata	Extract structured metadata from parsed documents for review.	done	large	high	{146f7f22-0b40-47c8-8251-3cc75348598d}	2026-08-01 00:00:00	2026-08-25 00:00:00	2026-03-06 21:13:41.195	2026-03-06 17:33:32.319816	2026-03-06 21:13:41.195
191ee0d8-2a3b-4fcc-9f24-684bdeb05901	97747fa0-40e2-4113-b6e6-dba6e033eae4	769aa68c-a3ab-4623-a92e-79d176cad1b3	Governance: CT-Level Compliance Baseline Template	Seed checklist template with Connecticut-priority obligations before condo-bylaw automation layers.	done	small	medium	{0952f3fc-2bb1-41b5-a89f-2d8661fb2a28}	2026-06-02 00:00:00	2026-06-14 00:00:00	2026-03-06 20:50:48.166	2026-03-06 17:43:50.504901	2026-03-06 20:58:23.34
856c9886-e612-4d23-a98b-5fd2d6582fc0	b1376498-d4d1-4400-ac8b-3b5a2ce6aea0	22578483-6c12-4d97-b026-62597fcb5e51	4.2.3 Store Parsed Data	Persist extracted data drafts with review/approval state.	done	medium	medium	{4d26e349-f0bb-4ad5-a7cf-2d205987176d}	2026-08-20 00:00:00	2026-09-05 00:00:00	2026-03-06 21:13:41.2	2026-03-06 17:33:32.323624	2026-03-06 21:13:41.2
56f44985-d726-4e5c-a951-3acdefe0df5c	567fd831-d3fb-4867-8565-1609e8bea1c2	a2f542b2-97ad-41be-86af-d6d957b3d998	7.1.1 Generate Notice Template	Create reusable notice templates for association communication.	done	medium	medium	{}	2026-09-10 00:00:00	2026-09-25 00:00:00	2026-03-06 21:20:59.754	2026-03-06 17:33:32.328562	2026-03-06 21:20:59.754
160e0e2e-635f-4353-adb5-3e1e63e1cb4c	567fd831-d3fb-4867-8565-1609e8bea1c2	ce565bb6-6198-4524-b3a3-2de40ca482e4	7.1.2 Send Email Notice	Enable outbound email notice delivery via integration layer.	done	large	medium	{56f44985-d726-4e5c-a951-3acdefe0df5c}	2026-09-20 00:00:00	2026-10-15 00:00:00	2026-03-06 21:20:59.761	2026-03-06 17:33:32.33233	2026-03-06 21:20:59.761
5dcd1b2f-5396-4b91-afe3-4f8b09ac1f9e	567fd831-d3fb-4867-8565-1609e8bea1c2	753bde20-ebb0-482d-a49c-d07f411a5f16	7.1.3 Log Communication History	Persist communication event history for audit and support.	done	medium	medium	{160e0e2e-635f-4353-adb5-3e1e63e1cb4c}	2026-10-01 00:00:00	2026-10-20 00:00:00	2026-03-06 21:20:59.763	2026-03-06 17:33:32.336232	2026-03-06 21:20:59.763
bc9cd571-e931-443c-ab45-7e39fa5be4c6	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	88aa305f-0fed-447d-b12c-d1352e3c6120	4.1.2 Tag Document to Entity	Associate documents with entities such as association, unit, or person.	done	medium	medium	{6d092649-1d0e-4ffc-84aa-d262846ab69f}	2026-03-20 00:00:00	2026-03-29 00:00:00	2026-03-06 18:16:34.298	2026-03-06 17:33:32.246362	2026-03-06 18:16:34.298
e5363ecd-5fbb-4b81-b494-b81295f2e4a2	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	d82033cc-3ed0-4096-96cd-cb426534f216	1.1.1 Create Unit Record	Create and persist unit records with unique identifiers in the master registry.	done	small	high	{}	2026-03-01 00:00:00	2026-03-06 00:00:00	2026-03-06 18:04:07.045	2026-03-06 17:33:32.155855	2026-03-06 18:04:07.045
006a4f17-98a1-4ed4-8dfc-e596a3243707	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	d82033cc-3ed0-4096-96cd-cb426534f216	1.1.3 Track Unit Lifecycle History	Capture historical change logs for unit configuration and lifecycle events.	done	medium	medium	{c8e4fd88-9042-444a-99b1-ddceef7030b3}	2026-03-15 00:00:00	2026-03-28 00:00:00	2026-03-06 18:16:34.291	2026-03-06 17:33:32.196815	2026-03-06 18:16:34.291
c8e4fd88-9042-444a-99b1-ddceef7030b3	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	d82033cc-3ed0-4096-96cd-cb426534f216	1.1.2 Edit Unit Attributes	Support updates to structural and identifying unit attributes.	done	small	high	{e5363ecd-5fbb-4b81-b494-b81295f2e4a2}	2026-03-01 00:00:00	2026-03-06 00:00:00	2026-03-06 18:08:59.341	2026-03-06 17:33:32.191564	2026-03-06 18:08:59.341
80b203af-a4f9-4430-b0e2-e5c78679c389	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	88aa305f-0fed-447d-b12c-d1352e3c6120	4.1.3 Maintain Document Version History	Track and retain document revisions with history metadata.	done	medium	medium	{bc9cd571-e931-443c-ab45-7e39fa5be4c6}	2026-03-25 00:00:00	2026-04-05 00:00:00	2026-03-06 18:16:34.304	2026-03-06 17:33:32.25046	2026-03-06 18:16:34.304
05b231c8-17e0-4cf0-81aa-b53d47ebf9f2	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	0b8f0f54-dbd3-46d5-a8d3-25b321e2a06b	8.1.1 Assign User Role	Role assignment foundation for platform access control.	done	medium	high	{}	2026-03-12 00:00:00	2026-03-20 00:00:00	2026-03-06 18:16:34.308	2026-03-06 17:33:32.254905	2026-03-06 18:16:34.308
328cfb8c-4e56-4376-bc17-d1dbdd9b96fd	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	0b8f0f54-dbd3-46d5-a8d3-25b321e2a06b	8.1.3 Validate Permission Changes	Track and validate permission change events with auditability.	done	medium	high	{9b5807b6-2847-42e8-b297-bd640b48e5d8}	2026-03-19 00:00:00	2026-03-31 00:00:00	2026-03-06 18:16:34.312	2026-03-06 17:33:32.261311	2026-03-06 18:16:34.312
6bd69e57-bc03-4f58-9552-91d05f722db0	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	bd60a4ad-56b6-4f35-af7f-de0d57c1904f	1.2.3 Manage Multiple Owners	Support joint ownership per unit and owner-to-multiple-unit mapping.	done	small	high	{6db6297a-2ef5-458a-9e30-ef31c41fa4eb}	2026-03-01 00:00:00	2026-03-06 00:00:00	2026-03-06 18:23:07.342	2026-03-06 17:33:32.214102	2026-03-06 18:23:07.342
9f0b89f1-deff-47c1-8617-910779b7aa9a	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	ee2eae57-d340-44f1-879a-f9c791a87286	1.3.2 Store Tenant Contact Record	Persist tenant contact records associated with occupied units.	done	small	high	{d9333deb-0734-43c8-b112-e8c0a6c10e30}	2026-03-01 00:00:00	2026-03-06 00:00:00	2026-03-06 18:23:07.345	2026-03-06 17:33:32.222935	2026-03-06 18:23:07.345
f7d4af4a-2eba-4f8c-9816-f5b17234cafd	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	ee2eae57-d340-44f1-879a-f9c791a87286	1.3.3 Track Occupancy History	Track start/end occupancy changes over time for auditability.	done	small	high	{9f0b89f1-deff-47c1-8617-910779b7aa9a}	2026-03-01 00:00:00	2026-03-06 00:00:00	2026-03-06 18:23:07.348	2026-03-06 17:33:32.225969	2026-03-06 18:23:07.348
79d295f5-804a-4a06-b03c-dc017e8f12e2	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	9a954185-9d87-4874-a96f-adbd366616d9	2.1.1 Assign Board Member Role	Assign officer and board roles to people records.	done	small	high	{}	2026-03-01 00:00:00	2026-03-06 00:00:00	2026-03-06 18:23:07.352	2026-03-06 17:33:32.229794	2026-03-06 18:23:07.352
8a3fe6ae-1be2-4caf-9ceb-02b9cc50ada4	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	9a954185-9d87-4874-a96f-adbd366616d9	2.1.2 Store Board Role Metadata	Store role title, dates, and association linkage metadata.	done	small	high	{79d295f5-804a-4a06-b03c-dc017e8f12e2}	2026-03-01 00:00:00	2026-03-06 00:00:00	2026-03-06 18:23:07.355	2026-03-06 17:33:32.23379	2026-03-06 18:23:07.355
6d092649-1d0e-4ffc-84aa-d262846ab69f	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	88aa305f-0fed-447d-b12c-d1352e3c6120	4.1.1 Upload Document	Upload and store governing and operational documents.	done	small	high	{}	2026-03-01 00:00:00	2026-03-06 00:00:00	2026-03-06 18:23:07.359	2026-03-06 17:33:32.242523	2026-03-06 18:23:07.359
9b5807b6-2847-42e8-b297-bd640b48e5d8	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	0b8f0f54-dbd3-46d5-a8d3-25b321e2a06b	8.1.2 Restrict Data Access	Enforce role-based restrictions for admin modules.	done	medium	critical	{05b231c8-17e0-4cf0-81aa-b53d47ebf9f2}	2026-03-07 00:00:00	2026-03-18 00:00:00	2026-03-06 18:23:07.364	2026-03-06 17:33:32.258156	2026-03-06 18:23:07.364
d9333deb-0734-43c8-b112-e8c0a6c10e30	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	ee2eae57-d340-44f1-879a-f9c791a87286	1.3.1 Submit Tenant Information Form	Capture tenant contact and emergency details through admin workflow.	done	medium	medium	{}	2026-03-18 00:00:00	2026-03-24 00:00:00	2026-03-06 18:23:07.367	2026-03-06 17:33:32.218681	2026-03-06 18:23:07.367
f3aa2e43-74d9-4c04-8d64-65cf10f157d4	8bc174fd-d350-4f41-833f-fc641200ec55	de2d1957-77f3-4589-90d2-8f183abd78e9	3.1.2 Create Special Assessment	Model and issue special assessments including installments.	done	large	high	{f740311f-1074-44b0-8987-e532051840d2}	2026-04-15 00:00:00	2026-05-05 00:00:00	2026-03-06 18:52:02.56	2026-03-06 17:33:32.268629	2026-03-06 18:52:02.56
f740311f-1074-44b0-8987-e532051840d2	8bc174fd-d350-4f41-833f-fc641200ec55	2ff685f0-9625-4864-b45a-ad4c4040584c	3.1.1 Create HOA Fee Schedule	Define recurring HOA/common charge schedules.	done	large	critical	{}	2026-04-01 00:00:00	2026-04-20 00:00:00	2026-03-06 18:52:02.492	2026-03-06 17:33:32.265202	2026-03-06 18:52:02.492
f997e5e0-7e3c-4627-8cf4-dcd958d809e6	8bc174fd-d350-4f41-833f-fc641200ec55	4a03648a-4e20-4379-a365-11935858fc6d	3.2.2 Track Utility Payments	Track utility payment entries and payment status.	done	medium	medium	{1a525b07-e39d-460f-8ce6-63f26cf194da}	2026-04-18 00:00:00	2026-05-06 00:00:00	2026-03-06 19:11:07.555	2026-03-06 17:33:32.283953	2026-03-06 19:11:07.555
a75a8a9f-1eaf-48a7-bb0c-46e3f9bf0e3b	8bc174fd-d350-4f41-833f-fc641200ec55	a11a1942-708c-4aa9-93f0-fd7aeeef7642	3.1.3 Calculate Late Fees	Implement configurable late fee policy and calculation logic.	done	medium	high	{f740311f-1074-44b0-8987-e532051840d2}	2026-04-22 00:00:00	2026-05-08 00:00:00	2026-03-06 18:54:57.819	2026-03-06 17:33:32.272224	2026-03-06 18:54:57.819
1a525b07-e39d-460f-8ce6-63f26cf194da	8bc174fd-d350-4f41-833f-fc641200ec55	68245579-abd9-419d-813b-169a57a542f7	3.2.1 Record Vendor Invoice	Record vendor invoices and base expense metadata.	done	medium	high	{}	2026-04-10 00:00:00	2026-04-28 00:00:00	2026-03-06 19:11:07.549	2026-03-06 17:33:32.280246	2026-03-06 19:11:07.549
17de101b-3a6e-4191-a674-ed9fabe993d3	8bc174fd-d350-4f41-833f-fc641200ec55	68245579-abd9-419d-813b-169a57a542f7	3.2.3 Store Expense Attachments	Attach and retain invoice/expense supporting files.	done	small	medium	{1a525b07-e39d-460f-8ce6-63f26cf194da}	2026-04-22 00:00:00	2026-05-03 00:00:00	2026-03-06 19:11:07.56	2026-03-06 17:33:32.288435	2026-03-06 19:11:07.56
692c3d0a-2a2c-4c50-9a49-6acbfb82fdc4	567fd831-d3fb-4867-8565-1609e8bea1c2	3488d266-4320-4bdb-8065-5ad104fa3b67	Platform: Multi-Association Data Isolation Foundation	Establish tenancy boundaries and association-scoped data patterns for future multi-complex scaling.	done	large	high	{}	2026-09-15 00:00:00	2026-10-10 00:00:00	2026-03-06 21:20:59.769	2026-03-06 17:43:50.52985	2026-03-06 21:20:59.769
2a0ccb83-9303-4fde-96a2-7c9c4087e5ed	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	bb9090ec-ea74-4b89-b081-cbef52a0c8c9	1.2.1 Create Owner Profile	Create owner profiles to support ownership relationships.	done	small	high	{}	2026-03-01 00:00:00	2026-03-06 00:00:00	2026-03-06 18:23:07.371	2026-03-06 17:33:32.202382	2026-03-06 18:23:07.371
5bf73ffc-a462-400e-b5d6-1beee5ebcc1e	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	5b4985d7-8e9c-47fb-a9d2-4397c5d424af	Foundation: Configure Association Baseline	Establish association profile, governance baseline, and configuration needed by downstream registry modules.	done	small	high	{}	2026-03-01 00:00:00	2026-03-04 00:00:00	2026-03-06 18:23:07.374	2026-03-06 17:43:50.42966	2026-03-06 18:23:07.374
6bac3acb-6ce5-4a31-abd1-2e82c14c8de9	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	d82033cc-3ed0-4096-96cd-cb426534f216	Foundation: Load Initial 18-Unit Roster with Addresses	Load and verify the initial 18-unit roster and addresses for New Haven deployment.	done	small	high	{5bf73ffc-a462-400e-b5d6-1beee5ebcc1e,e5363ecd-5fbb-4b81-b494-b81295f2e4a2}	2026-03-04 00:00:00	2026-03-06 00:00:00	2026-03-06 18:23:07.376	2026-03-06 17:43:50.43391	2026-03-06 18:23:07.376
931ba38a-6243-4ced-99f4-04061a5d1bbc	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	d73e3106-2d55-4aff-ae9e-3b9f9a6a6646	Foundation: Admin Dashboard Shell for Registry Modules	Provide left-nav admin dashboard shell and quick metrics for registry and governance modules.	done	small	medium	{5bf73ffc-a462-400e-b5d6-1beee5ebcc1e}	2026-03-03 00:00:00	2026-03-08 00:00:00	2026-03-06 18:23:07.38	2026-03-06 17:43:50.437317	2026-03-06 18:23:07.38
04b997d4-9af4-4381-a27d-8c1619251339	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	88aa305f-0fed-447d-b12c-d1352e3c6120	Remediation: Add Document Version Management UI Workflow	Expose version history list and upload-new-version flow in admin documents page including replacement context.	done	medium	high	{d2615072-3d2c-4f0f-a121-54e6ba6c8df0}	\N	\N	2026-03-06 18:43:02.838	2026-03-06 18:31:15.429372	2026-03-06 18:43:02.838
71cb39d3-e321-403d-a52f-e4c381abe7a7	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	0b8f0f54-dbd3-46d5-a8d3-25b321e2a06b	Remediation: Add Permission Change Review Surface	Add admin users page to list users, change roles with required reason, and show validation errors clearly.	done	medium	high	{bfe4e6c8-c475-4179-ad29-9aa8145d1e8e}	\N	\N	2026-03-06 18:43:02.845	2026-03-06 18:31:15.432449	2026-03-06 18:43:02.845
0837f8e6-3e0f-4673-a639-82a88833083c	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	d73e3106-2d55-4aff-ae9e-3b9f9a6a6646	Remediation: Add Phase 1 Verification Test Suite	Create integration checks for RBAC guards, unit history actor logging, document tags/versions, and permission-change validations.	done	large	high	{86156bbb-266b-4cfe-8f0c-64c663e0c5e1,04b997d4-9af4-4381-a27d-8c1619251339,71cb39d3-e321-403d-a52f-e4c381abe7a7}	\N	\N	2026-03-06 18:44:24.928	2026-03-06 18:31:15.4353	2026-03-06 18:44:24.928
1c647ab0-f17b-4d18-a74c-7cb779c6ca4f	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	5b4985d7-8e9c-47fb-a9d2-4397c5d424af	Remediation: Revalidate and Reclose Phase 1 Exit Criteria	Run acceptance checklist against implemented behavior and only then mark remaining Phase 1 governance/auth/document tasks complete.	done	small	high	{0837f8e6-3e0f-4673-a639-82a88833083c}	\N	\N	2026-03-06 18:44:24.979	2026-03-06 18:31:15.439666	2026-03-06 18:44:24.979
b0a06866-d41b-4e54-8d33-9ca7518ae1bf	8bc174fd-d350-4f41-833f-fc641200ec55	819ef8cb-6fd8-41a1-9fe9-f83b7cdcb8ce	3.1.4 Track Owner Ledger Balance	Compute and present per-owner charges, payments, and balance.	done	large	critical	{f740311f-1074-44b0-8987-e532051840d2,f3aa2e43-74d9-4c04-8d64-65cf10f157d4,a75a8a9f-1eaf-48a7-bb0c-46e3f9bf0e3b}	2026-04-25 00:00:00	2026-05-20 00:00:00	2026-03-06 19:11:07.566	2026-03-06 17:33:32.276528	2026-03-06 19:11:07.566
54c20d5d-47d9-4c3d-8b6d-08255933ffd0	8bc174fd-d350-4f41-833f-fc641200ec55	ab01d8e7-1871-43d1-b0e1-98779e264701	Finance Foundation: Configure Financial Accounts and Categories	Create baseline financial account/category configuration for invoice, utility, and budget workflows.	done	medium	medium	{}	2026-04-12 00:00:00	2026-04-24 00:00:00	2026-03-06 19:11:07.57	2026-03-06 17:43:50.469964	2026-03-06 19:11:07.57
86156bbb-266b-4cfe-8f0c-64c663e0c5e1	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	0b8f0f54-dbd3-46d5-a8d3-25b321e2a06b	Remediation: Enforce RBAC on All Phase 1 CRUD Routes	Apply admin role checks to associations, units, persons, ownerships, occupancies, board roles, and documents endpoints with least-privilege policy.	done	medium	critical	{}	\N	\N	2026-03-06 18:43:02.491	2026-03-06 18:31:15.413649	2026-03-06 18:43:02.491
bfe4e6c8-c475-4179-ad29-9aa8145d1e8e	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	0b8f0f54-dbd3-46d5-a8d3-25b321e2a06b	Remediation: Remove Auto-Escalation Admin Bootstrap Path	Replace auto-creation of platform-admin from request headers with explicit controlled bootstrap and fail-closed behavior.	done	small	critical	{86156bbb-266b-4cfe-8f0c-64c663e0c5e1}	\N	\N	2026-03-06 18:43:02.77	2026-03-06 18:31:15.41878	2026-03-06 18:43:02.77
d7ff212b-6c32-45bc-8171-fdc99e4143ab	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	d82033cc-3ed0-4096-96cd-cb426534f216	Remediation: Capture Actor Identity in Unit Change History	Propagate authenticated admin identity into unit lifecycle history change logs instead of system placeholder values.	done	small	high	{}	\N	\N	2026-03-06 18:43:02.829	2026-03-06 18:31:15.422957	2026-03-06 18:43:02.829
d2615072-3d2c-4f0f-a121-54e6ba6c8df0	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	88aa305f-0fed-447d-b12c-d1352e3c6120	Remediation: Add Document Tagging UI Workflow	Expose document tag create/list interactions in admin documents page using document tag APIs.	done	medium	high	{}	\N	\N	2026-03-06 18:43:02.834	2026-03-06 18:31:15.426036	2026-03-06 18:43:02.834
59ac98f4-e15e-4d19-9afc-520d9a8ed790	4ae90483-27e3-46a6-8c5f-56d57669618a	e5cf2ca5-ad7f-48b1-a6ce-dcda777a150f	Implement communication history log as a first-class record	Store outbound and inbound communication events with sender, recipients, channel, delivery status, timestamps, and related entity links for traceability. (FTPH 7.1.3)	done	medium	high	{}	2026-03-16 00:00:00	2026-03-29 00:00:00	2026-03-11 13:30:27.516	2026-03-11 13:12:27.201168	2026-03-11 14:06:12.717
d416640b-11dd-4c5a-a4cd-eda58b223bf2	4ae90483-27e3-46a6-8c5f-56d57669618a	e5cf2ca5-ad7f-48b1-a6ce-dcda777a150f	Define template scoping model for global and association-level templates	Support global baseline templates with per-association overrides and conflict resolution rules to preserve consistency while allowing local policy differences. (FTPH 7.1 Open Question)	done	small	medium	{3fc2b8b6-ef45-4fd8-aa8f-8d28850eb275}	2026-03-16 00:00:00	2026-03-29 00:00:00	2026-03-11 13:30:27.512	2026-03-11 13:12:27.219412	2026-03-11 14:06:12.713
838c6ad1-1c47-451c-9274-b1b6059f71cd	4ae90483-27e3-46a6-8c5f-56d57669618a	d5abf9a7-9a40-4680-a3a9-6b39d1bb69de	Implement SLA timers and escalation rules for high-priority maintenance requests	Configure response and resolution SLAs with automated escalation notices when urgent requests are not acknowledged in target windows. (FTPH 7.3 Open Question)	done	medium	medium	{62d3370a-1f36-42c8-8782-15c24c8c46e3,2abe0f36-45af-4158-bde9-fa802350433c}	2026-04-27 00:00:00	2026-05-10 00:00:00	2026-03-11 13:55:00.96	2026-03-11 13:12:27.277389	2026-03-11 14:06:12.72
2a5ea099-1f7c-4e49-8e03-ffc36ab7d0d7	7e5b4164-9714-412b-91a2-14ff5c5b55d6	427d9f2d-e9e1-4966-9cee-20adb8cf269b	Harden admin entitlement for OAuth users and remove default key fallbacks	Remove implicit dev admin headers/keys, stop auto-provisioning admin permissions on Google login, and scope association visibility to assigned admin scopes.	done	medium	critical	{}	\N	\N	2026-03-12 20:34:33.897	2026-03-12 20:34:33.898813	2026-03-12 20:34:33.898813
b04448ed-fd26-47da-b6e6-b01238eb15b0	9efff677-7938-4f3f-8580-2bff3e3765c2	a239134c-4744-40dc-8e15-5fc57af2e90f	Create executive updates and evidence tables	Add normalized tables for executive highlights and defend/evidence entries with timestamps and ownership.	done	medium	high	{}	\N	\N	2026-03-07 16:16:30.598	2026-03-07 16:12:06.461389	2026-03-07 16:16:30.598
8be6f431-e67b-4af5-b063-6ca475f095c4	9efff677-7938-4f3f-8580-2bff3e3765c2	a239134c-4744-40dc-8e15-5fc57af2e90f	Add admin-restricted executive API contracts	Implement list/create/update endpoints for highlights and evidence logs.	done	medium	high	{}	\N	\N	2026-03-07 16:16:30.598	2026-03-07 16:12:06.467296	2026-03-07 16:16:30.598
adb02e1d-9059-4832-9d13-e2b0a47cec6c	9efff677-7938-4f3f-8580-2bff3e3765c2	7dfc1759-c392-4561-9da4-2defa0b8106f	Build Executive page with Highlights and Defend tabs	Create a two-tab admin module for customer-facing highlights and proof-oriented evidence entries.	done	medium	high	{}	\N	\N	2026-03-07 16:16:30.598	2026-03-07 16:12:06.603642	2026-03-07 16:16:30.598
d1428bc6-6977-4645-b60a-ed1cb36900e4	9efff677-7938-4f3f-8580-2bff3e3765c2	7dfc1759-c392-4561-9da4-2defa0b8106f	Enforce concise executive copy standards	Apply headline length and summary constraints to keep updates short, clear, and sales-ready.	done	small	medium	{}	\N	\N	2026-03-07 16:16:30.598	2026-03-07 16:12:06.608076	2026-03-07 16:16:30.598
590918bd-d01f-48c2-bb66-1145ef5b0d49	9efff677-7938-4f3f-8580-2bff3e3765c2	2b363c41-cf1c-4870-b144-d9d9508e18fa	Implement roadmap-to-executive sync job	Create a sync path that captures completed roadmap items and generates executive summary cards.	done	medium	high	{}	\N	\N	2026-03-07 16:16:30.598	2026-03-07 16:12:06.619269	2026-03-07 16:16:30.598
d195a1ab-0af2-46f5-b66f-e810e23a0530	9efff677-7938-4f3f-8580-2bff3e3765c2	2b363c41-cf1c-4870-b144-d9d9508e18fa	Deduplicate sync updates by source task linkage	Ensure repeated sync operations do not create duplicate executive updates.	done	small	high	{}	\N	\N	2026-03-07 16:16:30.598	2026-03-07 16:12:06.622794	2026-03-07 16:16:30.598
fccb3be1-1656-4474-b29b-b46304b53152	9efff677-7938-4f3f-8580-2bff3e3765c2	ba6bf2dc-d369-451c-8ef1-758754ab9e1b	Add verification script for executive module	Validate API behavior, sync generation, and evidence linkage.	done	small	medium	{}	\N	\N	2026-03-07 16:16:30.598	2026-03-07 16:12:06.633591	2026-03-07 16:16:30.598
272f92a3-fb8b-4815-919e-ef76316f3a65	9efff677-7938-4f3f-8580-2bff3e3765c2	ba6bf2dc-d369-451c-8ef1-758754ab9e1b	Validate end-to-end admin workflow	Confirm users can create, edit, and review executive highlights and defend logs from the admin UI.	done	small	medium	{}	\N	\N	2026-03-07 16:16:30.598	2026-03-07 16:12:06.638246	2026-03-07 16:16:30.598
05be68bc-5e57-49eb-9318-b8b8489edeec	7e5b4164-9714-412b-91a2-14ff5c5b55d6	427d9f2d-e9e1-4966-9cee-20adb8cf269b	Enforce single-admin policy and deactivate legacy admin identities	Execute one-time admin cleanup so only approved admin email remains active; deactivate all others, remove their scopes, and detach non-approved auth->admin links.	done	small	critical	{}	\N	\N	2026-03-12 21:20:31.435	2026-03-12 21:20:31.437127	2026-03-12 21:20:31.437127
ae45b45a-26b4-4255-8414-d913f925f170	4ae90483-27e3-46a6-8c5f-56d57669618a	d5abf9a7-9a40-4680-a3a9-6b39d1bb69de	Automate payment instruction messaging using templates and config merge	Generate and deliver payment setup emails populated from association payment configuration with role-aware recipient routing. (ISS-009, ISS-010)	done	medium	medium	{247ca0df-f661-4256-89f3-305da5ec7ab5,3fc2b8b6-ef45-4fd8-aa8f-8d28850eb275,6d93383d-1746-47a1-9488-0b1f26bbd02f,62d3370a-1f36-42c8-8782-15c24c8c46e3}	2026-04-27 00:00:00	2026-05-10 00:00:00	2026-03-11 14:00:08.526	2026-03-11 13:10:05.479398	2026-03-11 14:06:12.723
5e31fabd-1e2f-44d2-a4a3-bd3cd5060d11	d869e3c4-d366-44f9-83e6-b6da45e24b80	cac1b596-e280-4d25-bbf8-97d9970e8602	Introduce canonical AuditLog table	Add a global audit table with actor, entity, action, before/after payload, and timestamp.	done	medium	critical	{}	\N	\N	2026-03-07 17:49:58.593	2026-03-07 17:28:27.738625	2026-03-07 17:49:58.593
a1051563-b830-46eb-aaf4-c325f4b2e387	fffb518f-1d5f-4ed1-8a3d-8eb036a1fde1	cd3433b1-abd1-4d2f-b25a-cfc439b88253	Create budget schema entities	Add Budget, BudgetLine, and BudgetVersion tables plus insert schemas and types.	done	medium	critical	{}	\N	\N	2026-03-07 17:56:23.609	2026-03-07 17:28:27.829517	2026-03-07 17:56:23.609
c466b1b9-6961-4999-8909-d50592e3d959	fffb518f-1d5f-4ed1-8a3d-8eb036a1fde1	cd3433b1-abd1-4d2f-b25a-cfc439b88253	Add budget storage interfaces	Implement CRUD/query methods for budget drafts, versions, and line items.	done	medium	high	{}	\N	\N	2026-03-07 17:56:23.609	2026-03-07 17:28:27.844199	2026-03-07 17:56:23.609
f000e4b7-2827-49e7-ba8d-039479838279	fffb518f-1d5f-4ed1-8a3d-8eb036a1fde1	b0f373fe-725e-46dc-be8f-5601175dc53a	Expose budget API endpoints	Add list/create/update and versioning routes under financial APIs.	done	medium	high	{}	\N	\N	2026-03-07 17:56:23.609	2026-03-07 17:28:27.857632	2026-03-07 17:56:23.609
32b169ec-afb0-40fd-9f51-a48fcc5fe7da	fffb518f-1d5f-4ed1-8a3d-8eb036a1fde1	0d4b4801-1f8d-44ef-aa47-ad1c936d9dbc	Build budget management screens	Add budget page for version timeline, line items, and ratification actions.	done	large	high	{}	\N	\N	2026-03-07 17:56:23.609	2026-03-07 17:28:27.908681	2026-03-07 17:56:23.609
e9a38198-a817-449e-8a31-b4f598a6318d	fffb518f-1d5f-4ed1-8a3d-8eb036a1fde1	0d4b4801-1f8d-44ef-aa47-ad1c936d9dbc	Add budget-vs-actual report	Compute and display planned vs actual variance by account/category and period.	done	medium	high	{}	\N	\N	2026-03-07 17:56:23.609	2026-03-07 17:28:27.915085	2026-03-07 17:56:23.609
c3aad6fd-6b04-4479-8388-a2a575a7f392	c9a3eb98-e4da-4d17-bac9-b3a4329ed363	ec61576c-d724-4268-a393-1947cd2c7830	Create governance detail schema	Add MeetingAgendaItem, MeetingNote, Resolution, VoteRecord, and CalendarEvent tables.	done	large	critical	{}	\N	\N	2026-03-07 18:05:24.403	2026-03-07 17:28:27.962319	2026-03-07 18:05:24.403
0df6040c-19ed-4c9b-8a6d-e6818bc6b224	c9a3eb98-e4da-4d17-bac9-b3a4329ed363	ec61576c-d724-4268-a393-1947cd2c7830	Add storage and API methods for governance details	Implement endpoints for creating, searching, and updating governance artifacts.	done	large	high	{}	\N	\N	2026-03-07 18:05:24.403	2026-03-07 17:28:27.966776	2026-03-07 18:05:24.403
f3fc7d1f-0f61-4efc-98d9-089316df93b4	c9a3eb98-e4da-4d17-bac9-b3a4329ed363	42a0a1bb-8438-4222-8c94-a1fc4f8f9f9b	Implement resolution lifecycle states	Support draft, open, approved, rejected, and archived resolution states.	done	medium	high	{}	\N	\N	2026-03-07 18:05:24.403	2026-03-07 17:28:27.983847	2026-03-07 18:05:24.403
81180397-e23a-4871-96ac-fbfde5c29db3	c9a3eb98-e4da-4d17-bac9-b3a4329ed363	cb6b416f-462b-4a9d-8be4-8467f4d702e1	Create governance calendar API	Aggregate meeting events and compliance deadlines into a single event feed.	done	medium	medium	{}	\N	\N	2026-03-07 18:05:24.403	2026-03-07 17:28:28.021111	2026-03-07 18:05:24.403
efa769c0-9504-4680-8b85-fc8f13a4e73e	c9a3eb98-e4da-4d17-bac9-b3a4329ed363	42a0a1bb-8438-4222-8c94-a1fc4f8f9f9b	Implement starter vote recording (no procedure engine)	Capture vote records and basic outcomes while explicitly deferring full parliamentary procedure rules per FTPH 5.1 scope boundary.	done	medium	high	{}	\N	\N	2026-03-07 18:05:24.403	2026-03-07 17:28:28.010516	2026-03-07 18:05:24.403
b929d768-4d7e-4bc2-897e-5ef77f9ba58c	e6c8ac97-a9a0-452a-85e9-2dbc332a5b3f	e2038410-480a-4486-9e2b-ff980e38888c	Monitor automated sweep job health in production logs	Validate scheduled notice delivery and maintenance escalation sweeps run without errors over multiple intervals.	in-progress	small	high	{}	\N	\N	\N	2026-03-11 14:18:20.89469	2026-03-11 14:18:20.89469
6c8d749a-e49f-4965-846e-0f76b6881c6a	bdcc5149-54c7-4b58-9581-e98ffaf685cc	60cec03b-5b57-42d6-a2ac-767612f7cfa6	Create portal access schema	Add PortalAccess and AssociationMembership entities with status and role constraints.	done	medium	critical	{}	\N	\N	2026-03-07 18:23:12.773	2026-03-07 17:28:28.09985	2026-03-07 18:23:12.773
7277168d-d52f-4d2e-aac5-f26414f8984e	bdcc5149-54c7-4b58-9581-e98ffaf685cc	60cec03b-5b57-42d6-a2ac-767612f7cfa6	Enforce owner-safe authorization	Implement scoped permission checks for owner-facing reads and profile updates.	done	medium	critical	{}	\N	\N	2026-03-07 18:23:12.773	2026-03-07 17:28:28.103319	2026-03-07 18:23:12.773
f248438a-04ea-4cf4-a101-450b896ff925	d869e3c4-d366-44f9-83e6-b6da45e24b80	cac1b596-e280-4d25-bbf8-97d9970e8602	Backfill existing unit/admin role history into canonical audit model	Normalize prior logging artifacts into shared audit shape for consistent querying.	done	medium	high	{}	\N	\N	2026-03-07 17:49:58.593	2026-03-07 17:28:27.743866	2026-03-07 17:49:58.593
ca304813-a7aa-4fca-accf-2c711fe6ef68	d869e3c4-d366-44f9-83e6-b6da45e24b80	8d4444eb-d064-4d14-8d78-907ce38c5d46	Add delete handlers for Phase 1 registries	Implement delete routes/services for associations, units, people, ownership, occupancy, board roles, and documents.	done	large	critical	{}	\N	\N	2026-03-07 17:49:58.593	2026-03-07 17:28:27.775142	2026-03-07 17:49:58.593
e607c7c9-8a94-40a6-a862-b900ce9f2f6e	d869e3c4-d366-44f9-83e6-b6da45e24b80	8d4444eb-d064-4d14-8d78-907ce38c5d46	Add integrity guards for destructive actions	Block or cascade deletes safely when linked records would become invalid.	done	medium	high	{}	\N	\N	2026-03-07 17:49:58.593	2026-03-07 17:28:27.780142	2026-03-07 17:49:58.593
eec2d713-8fdb-49ef-bb48-becf5af664ba	d869e3c4-d366-44f9-83e6-b6da45e24b80	dcadbc09-72d6-4a38-bd3d-a14dc047fb26	Enforce audit writes on all mutation endpoints	Wrap service-layer create/update/delete operations with mandatory audit event emission.	done	large	critical	{}	\N	\N	2026-03-07 17:49:58.593	2026-03-07 17:28:27.791616	2026-03-07 17:49:58.593
82d3c2e4-57e9-4efa-adff-d6aa0cf939b0	d869e3c4-d366-44f9-83e6-b6da45e24b80	dcadbc09-72d6-4a38-bd3d-a14dc047fb26	Add verification script for CRUD audit coverage	Validate all mutating endpoints generate audit records with actor attribution.	done	small	high	{}	\N	\N	2026-03-07 17:49:58.593	2026-03-07 17:28:27.804389	2026-03-07 17:49:58.593
f8ce9ec9-3784-48fd-883a-a940d4f10061	fffb518f-1d5f-4ed1-8a3d-8eb036a1fde1	b0f373fe-725e-46dc-be8f-5601175dc53a	Implement budget draft and ratification states	Support draft/proposed/ratified lifecycle transitions aligned with FTPH 6.1 annual checklist obligations (budget review and ratification).	done	medium	high	{}	\N	\N	2026-03-07 17:56:23.609	2026-03-07 17:28:27.853017	2026-03-07 17:56:23.609
9212a9c4-47d2-4793-bbe2-a2f80ef2ccf6	c9a3eb98-e4da-4d17-bac9-b3a4329ed363	cb6b416f-462b-4a9d-8be4-8467f4d702e1	Add calendar UI linked to tasks and meetings	Render upcoming obligations with drilldown into records and owners.	done	medium	medium	{}	\N	\N	2026-03-07 18:05:24.403	2026-03-07 17:28:28.024959	2026-03-07 18:05:24.403
73e64d27-2dbb-4810-8f01-d9c28a03964b	c9a3eb98-e4da-4d17-bac9-b3a4329ed363	42a0a1bb-8438-4222-8c94-a1fc4f8f9f9b	Enforce meeting-tracker scope boundaries	Preserve FTPH 5.1 boundaries by shipping starter vote capture only and deferring full voting procedure engines and scheduling integrations.	done	small	high	{}	\N	\N	2026-03-07 18:05:24.403	2026-03-07 17:33:17.305926	2026-03-07 18:05:24.403
87be893a-fd9e-4241-aa50-88bb83335631	3ae27457-bc53-46e5-8b09-e752623c97aa	38bb09de-d4b0-4f8c-a679-34074fae37aa	Create clause intelligence schema	Add ClauseRecord, ClauseTag, and SuggestedLink entities with provenance metadata.	done	medium	critical	{}	\N	\N	2026-03-07 18:12:37.964	2026-03-07 17:28:28.036246	2026-03-07 18:12:37.964
4776dfe2-d7c0-470c-8207-26891185eb6a	3ae27457-bc53-46e5-8b09-e752623c97aa	41105d24-b247-4a4f-b5b3-a46277015f8c	Add clause review endpoints	Expose API operations for review status, edits, and tag assignment for clause drafts.	done	medium	high	{}	\N	\N	2026-03-07 18:12:37.964	2026-03-07 17:28:28.051765	2026-03-07 18:12:37.964
cb5b6edd-5e40-4bf0-9b16-c0cccaf455f9	bdcc5149-54c7-4b58-9581-e98ffaf685cc	f4b26d41-c855-4e03-8b26-7592c2c6379c	Build owner portal routes and layout	Add owner-specific navigation and authenticated portal pages.	done	large	high	{}	\N	\N	2026-03-07 18:23:12.773	2026-03-07 17:28:28.11738	2026-03-07 18:23:12.773
b4ae27ee-79bc-42a0-a772-4e880f818eb8	bdcc5149-54c7-4b58-9581-e98ffaf685cc	f4b26d41-c855-4e03-8b26-7592c2c6379c	Implement contact update workflow	Allow owner-managed contact updates with moderation/audit trail.	done	medium	high	{}	\N	\N	2026-03-07 18:23:12.773	2026-03-07 17:28:28.120487	2026-03-07 18:23:12.773
0bad30d6-f69c-4541-9ea5-546730777492	bdcc5149-54c7-4b58-9581-e98ffaf685cc	f524059e-ad96-4080-8f1f-2e19f071789d	Add TenantConfig and EmailThread entities	Model per-association product settings and threaded communication artifacts.	done	medium	high	{}	\N	\N	2026-03-07 18:23:12.773	2026-03-07 17:28:28.127208	2026-03-07 18:23:12.773
60091821-00a1-41b4-827a-b954aeacffd4	bdcc5149-54c7-4b58-9581-e98ffaf685cc	f524059e-ad96-4080-8f1f-2e19f071789d	Add cross-association isolation tests	Verify hard tenant boundaries for portal, communications, and admin surfaces.	done	medium	high	{}	\N	\N	2026-03-07 18:23:12.773	2026-03-07 17:28:28.139336	2026-03-07 18:23:12.773
91fc1f85-0f2f-41a6-852e-136520748d2b	bdcc5149-54c7-4b58-9581-e98ffaf685cc	f524059e-ad96-4080-8f1f-2e19f071789d	Gate owner portal rollout as future-expansion capability	Implement feature-flagged rollout so owner portal aligns with FTPH future expansion scope and does not violate initial deployment assumptions.	done	small	high	{}	\N	\N	2026-03-07 18:23:12.773	2026-03-07 17:33:17.318415	2026-03-07 18:23:12.773
bd307b04-5081-4338-8b2d-d4cf3fea085b	d15814d0-848b-4513-9236-82b1755faa7b	4e1e2199-3aa1-46aa-9ced-72f840d47d2d	Add buildings domain model and unit-to-building linkage	Create buildings table fields and wire unit buildingId while preserving legacy building text compatibility.	done	medium	critical	{}	\N	\N	2026-03-12 16:32:21.378	2026-03-12 16:20:07.3372	2026-03-12 16:32:21.378
78e53ac6-4c8f-4f4a-a216-8bf3dbd42899	d15814d0-848b-4513-9236-82b1755faa7b	126b7d4f-4fb9-46ce-b8d8-3e2ee86aa357	Implement building-first Add Unit dialog flow	Add step 1 building capture (name, address, total units, notes) and step 2 unit creation bound to selected building.	done	large	critical	{}	\N	\N	2026-03-12 16:32:21.431	2026-03-12 16:20:07.360289	2026-03-12 16:32:21.431
c3655d12-18f7-4692-8f5d-ee85a670c3aa	d15814d0-848b-4513-9236-82b1755faa7b	126b7d4f-4fb9-46ce-b8d8-3e2ee86aa357	Preserve existing hierarchy and status indicators	Keep current building hierarchy, occupancy badges, and ownership rollups aligned with selected building entities.	done	medium	high	{}	\N	\N	2026-03-12 16:32:21.435	2026-03-12 16:20:07.364168	2026-03-12 16:32:21.435
9480daee-65e4-4aa9-afb6-03a3a7544f4c	e6c8ac97-a9a0-452a-85e9-2dbc332a5b3f	e2038410-480a-4486-9e2b-ff980e38888c	Remove QA validation seed data after UAT sign-off	Delete temporary verification association/unit/person and related artifacts once business signs off.	done	small	medium	{}	\N	\N	\N	2026-03-11 14:18:20.889877	2026-03-11 14:18:20.889877
738c0215-ca17-43e4-b29e-c3a9bfa9a6ce	3ae27457-bc53-46e5-8b09-e752623c97aa	41105d24-b247-4a4f-b5b3-a46277015f8c	Extend AI ingestion UI for clause review	Add before/after editing, confidence display, and approval controls for clause records.	done	medium	high	{}	\N	\N	2026-03-07 18:12:37.964	2026-03-07 17:28:28.055369	2026-03-07 18:12:37.964
c310c324-a253-45f0-a7d7-4aeca1be7034	3ae27457-bc53-46e5-8b09-e752623c97aa	503cf11f-e63c-46e5-877d-199c15cc0d26	Add clause search and filtering	Support filter by topic/tag/source document and confidence/review state.	done	small	medium	{}	\N	\N	2026-03-07 18:12:37.964	2026-03-07 17:28:28.084882	2026-03-07 18:12:37.964
7a7eda21-54e2-4980-828c-a899df47c6ac	3ae27457-bc53-46e5-8b09-e752623c97aa	38bb09de-d4b0-4f8c-a679-34074fae37aa	Link clause artifacts to ingestion pipeline	Persist clause candidates via review-first extraction, keeping all AI outputs editable and traceable to source per FTPH 4.2 implementation notes.	done	medium	high	{}	\N	\N	2026-03-07 18:12:37.964	2026-03-07 17:28:28.042099	2026-03-07 18:12:37.964
85b03e87-0324-4845-b2cb-e0701ac3e7ab	3ae27457-bc53-46e5-8b09-e752623c97aa	503cf11f-e63c-46e5-877d-199c15cc0d26	Expose approved clause references to governance modules	Link approved clauses to governance templates/tasks without autonomous legal interpretation, consistent with FTPH 4.2 scope boundary and CT-first rollout assumptions.	done	small	medium	{}	\N	\N	2026-03-07 18:12:37.964	2026-03-07 17:28:28.089123	2026-03-07 18:12:37.964
96cc0378-77b9-464b-83d6-bafc92cc0fdd	3ae27457-bc53-46e5-8b09-e752623c97aa	41105d24-b247-4a4f-b5b3-a46277015f8c	Enforce review-first AI governance	Require human approval/edit before production use, with no autonomous legal interpretation, aligned to FTPH 4.2 scope boundary.	done	small	critical	{}	\N	\N	2026-03-07 18:12:37.964	2026-03-07 17:33:17.31331	2026-03-07 18:12:37.964
de77886f-8858-4df1-8849-192dc48c09ff	25833155-96ba-4795-a8fe-3cb30d6870d8	8677553f-59dc-480e-8130-f3d9d2d2c36e	Capture operator corrections as structured feedback for future parser and routing improvements	Turn human fixes into learning signals so the ingestion engine improves from production usage.	in-progress	large	medium	{}	\N	\N	\N	2026-03-09 16:54:41.198391	2026-03-09 17:51:51.570049
6b295468-fde5-45cb-b691-5c1c362b685a	e1bbe890-04bd-4448-bed8-beb513dfb2bd	4fb07a5a-8204-4d90-8bf0-712c8eb9c0be	Protect uploaded documents behind authenticated authorization checks	Uploaded files are retrievable from a public endpoint without admin or portal authorization. Gate file reads by caller identity and document audience before serving content.	done	medium	critical	{}	\N	\N	\N	2026-03-07 21:55:08.710124	2026-03-16 13:41:12.788
2a9f04a6-1224-4863-804f-f8f3451cb49a	e1bbe890-04bd-4448-bed8-beb513dfb2bd	3ce02e26-8cf2-4002-8480-197da3a91f43	Replace email-only owner portal login with verifiable authentication	Portal sessions can be started with only associationId and email, and the returned portal access identifier becomes the long-lived credential. Add a verifiable login or magic-link flow with revocable session tokens.	done	large	critical	{}	\N	\N	\N	2026-03-07 21:55:08.694527	2026-03-16 13:41:12.77
f725a6c2-8f1d-4c9f-b8fb-de6efe077602	e1bbe890-04bd-4448-bed8-beb513dfb2bd	2be575d0-d5b7-41a2-bb72-afd4f8153e1b	Replace internal mock communications delivery with a real provider or explicit simulation state	Communication sends are persisted as sent using an internal mock provider and synthetic message IDs. Integrate a real delivery channel or clearly mark simulated sends to avoid false operational confidence.	todo	medium	high	{}	\N	\N	\N	2026-03-07 21:55:08.719545	2026-03-16 13:41:12.808
7c60e17c-aae0-453d-aab8-019226629e2e	e1bbe890-04bd-4448-bed8-beb513dfb2bd	c798d107-2fc0-4865-980c-6316ac80c986	Validate document file references and surface missing assets	Some stored document fileUrl values resolve to missing files. Add file existence validation, broken-link detection, and recovery handling so documents do not appear available when the asset is gone.	done	medium	high	{}	\N	\N	\N	2026-03-07 22:01:48.026206	2026-03-16 13:41:12.828
74e0150f-8b5a-4ea0-9120-6937a2479bd8	e1bbe890-04bd-4448-bed8-beb513dfb2bd	4fb07a5a-8204-4d90-8bf0-712c8eb9c0be	Enforce admin association scopes on server queries and mutations	Admin association scopes are configurable in the data model and UI, but request handling still trusts raw associationId filters. Apply scope checks centrally across read and write operations.	done	large	critical	{}	\N	\N	\N	2026-03-07 21:55:08.705633	2026-03-16 13:41:12.783
d6d438ad-42de-4ea3-9e22-3d07cfd2f22f	7e5b4164-9714-412b-91a2-14ff5c5b55d6	427d9f2d-e9e1-4966-9cee-20adb8cf269b	Make OAuth callback host-aware for preview and published environments	Resolve callback URL from current request origin when strict pinning is disabled, preventing cross-environment sign-in leakage between preview and published hosts.	done	small	high	{}	\N	\N	2026-03-12 21:26:21.195	2026-03-12 21:26:21.197668	2026-03-12 21:26:21.197668
fb39cf96-787b-455c-84dd-1c75d15e9730	e6c8ac97-a9a0-452a-85e9-2dbc332a5b3f	e2038410-480a-4486-9e2b-ff980e38888c	Integrate Gmail API provider and platform email test controls	Add Gmail API email provider support with fallback behavior, provider-status endpoint, and admin test-send controls.	done	medium	high	{}	\N	\N	2026-03-11 14:22:23.416	2026-03-11 14:22:23.417538	2026-03-11 14:22:23.417538
16e5274e-ef53-444f-9b96-77d2195b2ddc	e1bbe890-04bd-4448-bed8-beb513dfb2bd	c798d107-2fc0-4865-980c-6316ac80c986	Persist portal visibility fields during document creation	Document creation currently omits portal publication fields on create, which can leave intended owner-visible uploads unpublished. Persist isPortalVisible and portalAudience during initial upload or make the two-step publish flow explicit.	done	medium	high	{}	\N	\N	\N	2026-03-07 22:01:48.019218	2026-03-16 13:41:12.824
15633a53-a2e7-48ae-a6ee-38362fdffb12	a5451dd1-b5a1-44a7-b936-f34232faf0e5	e2aaa811-ca25-4894-8c8e-d6419e7227ac	Expand source parsing coverage for common admin artifacts	Handle owner rosters, contact lists, invoices, and bank statement exports with reliable normalization for csv, txt, json, and future document formats.	done	large	critical	{}	\N	\N	2026-03-09 15:20:44.989	2026-03-09 14:19:52.19913	2026-03-09 15:20:44.989
57f26dcb-b722-4cc4-831c-9a4f0a396f83	a5451dd1-b5a1-44a7-b936-f34232faf0e5	88165f6f-dd3b-44af-bbf5-6b8008503d0e	Introduce explicit document classifier with confidence thresholds	Classify each submission into supported types such as owner/contact roster, invoice, bank statement, governance text, or unknown with score and explanation metadata.	done	large	critical	{}	\N	\N	2026-03-09 15:23:43.857	2026-03-09 14:19:52.223644	2026-03-09 15:23:43.857
102e9977-aee9-4085-bb85-4d15a7a6d64e	d15814d0-848b-4513-9236-82b1755faa7b	21a6369a-43ed-4c14-aa1b-b92be8b46f4d	Run end-to-end verification against current active project baseline	Check unit create/edit and building flows do not reverse previously shipped enhancements.	done	small	high	{}	\N	\N	2026-03-12 16:32:21.444	2026-03-12 16:20:07.37822	2026-03-12 16:32:21.444
5e052ddb-542b-42f9-8b7f-e1f90da61cdc	d15814d0-848b-4513-9236-82b1755faa7b	4e1e2199-3aa1-46aa-9ced-72f840d47d2d	Add building CRUD endpoints with association scope checks	Expose GET/POST/PATCH building endpoints and enforce scoped admin access.	done	medium	high	{}	\N	\N	2026-03-12 16:32:21.448	2026-03-12 16:20:07.343624	2026-03-12 16:32:21.448
7e83eb73-7a41-4194-bccd-8174028d1551	a5451dd1-b5a1-44a7-b936-f34232faf0e5	c7aa0a43-ddb8-4e06-bfc9-b66c32d28243	Capture import audit trail and provenance links	Store who approved what, source job reference, extracted payload snapshot, target entity IDs, and timestamps for traceability and compliance review.	done	medium	high	{}	\N	\N	2026-03-09 15:23:43.857	2026-03-09 14:19:52.262204	2026-03-09 15:23:43.857
dc8893fb-9987-48fe-a644-184c7e7e38ef	a5451dd1-b5a1-44a7-b936-f34232faf0e5	c7aa0a43-ddb8-4e06-bfc9-b66c32d28243	Redesign review UI for record-level approve/edit/reject	Show extracted records grouped by target module with confidence, source excerpts, and inline correction before approval.	done	medium	high	{}	\N	\N	2026-03-09 15:36:13.689	2026-03-09 14:19:52.258847	2026-03-09 15:36:13.689
a7ed7063-a8d1-49b2-9416-1ac68257b04d	a62be175-0e65-4048-b1f3-4ed3dd75339a	de7a017b-2e9a-4ffe-b73c-ce2288ec007f	Add portal payment screen with live balance summary	Expose a payment view in the owner portal that shows outstanding balance, payable amount, due context, and next action into checkout.	done	medium	high	{b2418d78-e99a-4031-b0ab-b5cb8153298d}	\N	\N	\N	2026-03-14 12:59:58.212496	2026-03-14 12:59:58.305
cc1c1313-1a97-4b68-adaa-3faee58e6e90	a5451dd1-b5a1-44a7-b936-f34232faf0e5	91084474-44ad-48fa-8ef4-b80051ab3a47	Create verification scripts for end-to-end ingestion scenarios	Automate validation of representative owner list, contact update, invoice, and bank statement ingestion flows from intake to module write.	done	medium	medium	{}	\N	\N	2026-03-09 15:36:13.689	2026-03-09 14:19:52.275101	2026-03-09 15:36:13.689
06fd9a84-b928-46cd-ba34-91b35e08ed95	a5451dd1-b5a1-44a7-b936-f34232faf0e5	91084474-44ad-48fa-8ef4-b80051ab3a47	Define ingestion accuracy benchmarks by document type	Track precision/recall style metrics for key fields and require minimum pass thresholds before release for each supported document category.	done	medium	high	{}	\N	\N	2026-03-09 15:40:53.669	2026-03-09 14:19:52.271528	2026-03-09 15:40:53.669
99b3721f-a91f-42f7-9107-4cc2525cc318	a5451dd1-b5a1-44a7-b936-f34232faf0e5	91084474-44ad-48fa-8ef4-b80051ab3a47	Run staged rollout with monitoring and alerting	Release behind a feature flag, monitor ingestion success/failure patterns, and alert on classification drift, routing errors, and abnormal duplicate rates.	done	medium	medium	{}	\N	\N	2026-03-09 15:49:59.213	2026-03-09 14:19:52.278252	2026-03-09 15:49:59.213
b2418d78-e99a-4031-b0ab-b5cb8153298d	a62be175-0e65-4048-b1f3-4ed3dd75339a	bca90253-11f8-4420-9ce7-a6462c8ae039	Build hosted ACH and card checkout/session flow	Create a real payment-session flow so owner balances can be paid through a provider-backed checkout instead of admin-side token testing only.	todo	large	critical	{97397c10-f248-49c4-b99c-0183a8607d43}	\N	\N	\N	2026-03-14 12:59:58.174592	2026-03-14 12:59:58.297
6ea7d0ff-9678-4e78-8ac1-47402924d891	a5451dd1-b5a1-44a7-b936-f34232faf0e5	88165f6f-dd3b-44af-bbf5-6b8008503d0e	Create schema-specific extractors per document type	Enforce structured extraction contracts for each type so downstream import logic receives stable fields (for example owner identity fields, invoice line/amount/date, and transaction rows).	done	large	critical	{}	\N	\N	2026-03-09 15:20:44.989	2026-03-09 14:19:52.228262	2026-03-09 15:20:44.989
a1437795-04ff-44e9-8edf-6474c61f32f7	a5451dd1-b5a1-44a7-b936-f34232faf0e5	e2aaa811-ca25-4894-8c8e-d6419e7227ac	Add ingestion job preflight validation and actionable errors	Validate required association context, source readability, and minimum content quality before processing. Return field-level error messages and remediation guidance.	done	medium	high	{}	\N	\N	2026-03-09 15:20:44.989	2026-03-09 14:19:52.214062	2026-03-09 15:20:44.989
680ce5f1-30e5-4d7e-bf01-2bee68350802	a5451dd1-b5a1-44a7-b936-f34232faf0e5	88165f6f-dd3b-44af-bbf5-6b8008503d0e	Add fallback heuristics and partial extraction handling	When AI responses are incomplete or low-confidence, preserve partially extracted records, mark uncertainty reasons, and route for review rather than silently failing.	done	medium	high	{}	\N	\N	2026-03-09 15:20:44.989	2026-03-09 14:19:52.234482	2026-03-09 15:20:44.989
e5d97f82-3c9f-4dad-bd7b-e6ee56d7857f	a5451dd1-b5a1-44a7-b936-f34232faf0e5	c7aa0a43-ddb8-4e06-bfc9-b66c32d28243	Add rollback and remediation tools for failed imports	Provide controlled rollback or compensating actions for failed/incorrect commits, including partial-failure reports and retry support.	done	large	high	{}	\N	\N	2026-03-09 15:20:44.989	2026-03-09 14:19:52.265476	2026-03-09 15:20:44.989
305d8863-88f6-428e-8f63-4b652f539a65	a5451dd1-b5a1-44a7-b936-f34232faf0e5	78091e86-1b8c-4ee7-8461-6b45d782f9f5	Implement staged import pipeline with dry-run and commit modes	Provide preview mode that shows creates/updates/skips before write operations, then execute commit with per-row outcomes and idempotency protections.	done	large	critical	{}	\N	\N	2026-03-09 15:20:44.989	2026-03-09 14:19:52.247291	2026-03-09 15:20:44.989
33d6c580-3ff9-47b9-a074-354ca91f70e2	a62be175-0e65-4048-b1f3-4ed3dd75339a	de7a017b-2e9a-4ffe-b73c-ce2288ec007f	Link payment reminders and due notices to portal payment actions	Connect communications templates and payment links so reminders drive owners directly into the live payment experience.	done	medium	medium	{a7ed7063-a8d1-49b2-9416-1ac68257b04d}	\N	\N	\N	2026-03-14 12:59:58.229827	2026-03-14 12:59:58.314
680b90e1-4932-400e-a353-bb84aaa41990	a62be175-0e65-4048-b1f3-4ed3dd75339a	bca90253-11f8-4420-9ce7-a6462c8ae039	Add signed webhook verification and hardened payment event states	Verify provider signatures, enforce idempotency, and expand event handling so successful, failed, pending, and replayed payments behave predictably.	done	medium	critical	{97397c10-f248-49c4-b99c-0183a8607d43}	\N	\N	\N	2026-03-14 12:59:58.188369	2026-03-14 12:59:58.3
7050e672-6e4c-4d13-89eb-6c1cd66aee82	a62be175-0e65-4048-b1f3-4ed3dd75339a	936c0526-b7d0-4cc5-ae15-15cae70b57b4	Add autopay enrollment and schedule management	Allow owners to opt into recurring payment schedules using saved payment methods and visible enrollment controls.	done	large	high	{085a5e11-b423-4c05-96b5-2029c542d013}	\N	\N	\N	2026-03-14 12:59:58.240145	2026-03-14 12:59:58.317
39bfe213-8207-4b7b-87f5-03b9592f6fcd	a62be175-0e65-4048-b1f3-4ed3dd75339a	de7a017b-2e9a-4ffe-b73c-ce2288ec007f	Support partial-payment rules, receipts, and payment confirmations	Apply configurable full-vs-partial payment rules and send a durable confirmation trail for every completed payment.	done	medium	high	{a7ed7063-a8d1-49b2-9416-1ac68257b04d,680b90e1-4932-400e-a353-bb84aaa41990}	\N	\N	\N	2026-03-14 12:59:58.225291	2026-03-14 12:59:58.312
085a5e11-b423-4c05-96b5-2029c542d013	a62be175-0e65-4048-b1f3-4ed3dd75339a	de7a017b-2e9a-4ffe-b73c-ce2288ec007f	Support saved payment methods and owner-managed defaults	Allow owners to save and manage ACH/card methods through the provider-backed workflow instead of relying only on static payment instructions.	done	large	high	{b2418d78-e99a-4031-b0ab-b5cb8153298d}	\N	\N	\N	2026-03-14 12:59:58.22076	2026-03-14 12:59:58.309
a4cd64b3-1dc0-4794-902f-c502fcfefc75	a5451dd1-b5a1-44a7-b936-f34232faf0e5	e2aaa811-ca25-4894-8c8e-d6419e7227ac	Unify intake into file upload or pasted text with contextual notes	Allow an admin to provide a file, pasted text, or both, plus optional context instructions (for example period, association intent, and reconciliation notes) while retaining current job submission and review patterns.	done	medium	critical	{}	\N	\N	2026-03-09 15:20:44.989	2026-03-09 14:19:52.190803	2026-03-09 15:20:44.989
eca1faff-44ea-45c3-8fe4-fe49baf3e23c	a5451dd1-b5a1-44a7-b936-f34232faf0e5	78091e86-1b8c-4ee7-8461-6b45d782f9f5	Build ingestion-to-module routing matrix	Define authoritative mapping from extracted record types to target modules (owners/persons/ownerships, invoices, financial accounts/ledger, documents/governance) with versioned routing rules.	done	medium	critical	{}	\N	\N	2026-03-09 15:20:44.989	2026-03-09 14:19:52.243166	2026-03-09 15:20:44.989
3a83a9f2-21d1-4253-9d71-458bed413599	a5451dd1-b5a1-44a7-b936-f34232faf0e5	78091e86-1b8c-4ee7-8461-6b45d782f9f5	Add duplicate detection and smart matching	Match existing entities by normalized keys and fuzzy checks (unit, name, email, invoice reference, transaction amount/date) to reduce duplicate records and wrong module inserts.	done	large	high	{}	\N	\N	2026-03-09 15:20:44.989	2026-03-09 14:19:52.251752	2026-03-09 15:20:44.989
9abb421c-3787-4f68-b8b2-90fcb964d0f3	25833155-96ba-4795-a8fe-3cb30d6870d8	11d9bf83-ee92-4032-a0b9-c05ef729b2aa	Create unresolved-exception buckets for facts that do not cleanly map to the platform	Route ambiguous facts into review queues instead of forcing bad imports.	in-progress	medium	high	{}	\N	\N	\N	2026-03-09 16:54:41.198391	2026-03-09 17:47:19.06695
ae67b1d0-3596-458d-aaf0-b8758602edc9	25833155-96ba-4795-a8fe-3cb30d6870d8	11d9bf83-ee92-4032-a0b9-c05ef729b2aa	Build explicit destination routing rules from canonical entities to units, persons, ownerships, contacts, and exceptions	Make module population deterministic and reviewable instead of implicit in parser output.	in-progress	large	critical	{}	\N	\N	\N	2026-03-09 16:54:41.198391	2026-03-09 19:23:36.714287
9b5ed450-57fb-42fa-98ee-e51dcb16653b	25833155-96ba-4795-a8fe-3cb30d6870d8	8677553f-59dc-480e-8130-f3d9d2d2c36e	Strengthen preview mode to show entity-by-entity creates, updates, skips, and unresolved exceptions	Expose the exact platform impact before commit for units, persons, ownerships, and related contacts.	done	medium	high	{}	\N	\N	2026-03-09 17:51:51.570049	2026-03-09 16:54:41.198391	2026-03-09 17:51:51.570049
29090771-1e37-4720-96bd-862d3fd721fc	25833155-96ba-4795-a8fe-3cb30d6870d8	8677553f-59dc-480e-8130-f3d9d2d2c36e	Add targeted rollback and reprocess tooling for ingestion batches	Allow operators to revert or rerun a bad batch without manual database cleanup.	done	medium	high	{}	\N	\N	2026-03-09 19:49:34.121302	2026-03-09 16:54:41.198391	2026-03-09 19:49:34.121302
c5e72d89-26bb-41c0-9390-016eda8c3f4b	d15814d0-848b-4513-9236-82b1755faa7b	21a6369a-43ed-4c14-aa1b-b92be8b46f4d	Retain backward compatibility for legacy units without buildingId	Ensure existing units render and remain editable without forced migration.	done	small	high	{}	\N	\N	2026-03-12 16:32:21.44	2026-03-12 16:20:07.37498	2026-03-12 16:32:21.44
29899364-fcbf-4e07-b298-e2306f7373cd	25833155-96ba-4795-a8fe-3cb30d6870d8	cf08a4ef-a199-488c-86a5-f1422ea293a6	Implement hierarchical segmentation for repeating building and unit roster blocks	Split pasted rosters into building-level sections and unit-level rows so address headers and owner rows are not conflated.	in-progress	large	critical	{}	\N	\N	\N	2026-03-09 16:54:41.198391	2026-03-09 17:12:28.303642
ed40a145-f6cc-4b06-ae5f-6dcf9bd34e44	25833155-96ba-4795-a8fe-3cb30d6870d8	cfda0ef3-a905-4aed-9d2b-cfca15246391	Create canonical ingestion entities for building, unit, person, contact point, ownership candidate, and notes	Introduce an intermediate normalized graph so raw source facts are preserved before module routing decides what becomes units, persons, and ownerships.	in-progress	large	critical	{}	\N	\N	\N	2026-03-09 16:54:41.198391	2026-03-09 17:12:28.303642
ce8ad773-f264-4594-b7b6-df984e778255	25833155-96ba-4795-a8fe-3cb30d6870d8	cfda0ef3-a905-4aed-9d2b-cfca15246391	Support multi-owner, multi-email, multi-phone, and relationship-note preservation	Keep compound owner rows intact as structured facts instead of flattening them into lossy single-value fields.	in-progress	large	critical	{}	\N	\N	\N	2026-03-09 16:54:41.198391	2026-03-09 17:12:28.303642
d5c7c624-33f4-4e85-b508-7a3b0352351f	25833155-96ba-4795-a8fe-3cb30d6870d8	6f29dc92-839d-4e56-b03e-33effe42e608	Assemble benchmark fixtures from real HOA and condo source formats	Create a durable corpus of owner rosters, bank statements, invoices, and governance docs drawn from realistic property-management operating formats.	done	large	critical	{}	\N	\N	2026-03-09 19:45:56.378528	2026-03-09 16:54:41.198391	2026-03-09 19:45:56.378528
2e43e864-3af3-4804-a60a-ba48a7ad49b7	25833155-96ba-4795-a8fe-3cb30d6870d8	6f29dc92-839d-4e56-b03e-33effe42e608	Add automated regression scoring for extraction quality, routing quality, and import safety	Measure whether a change improves or degrades ingestion performance before release.	done	large	critical	{}	\N	\N	2026-03-09 19:45:56.378528	2026-03-09 16:54:41.198391	2026-03-09 19:45:56.378528
916f659e-e1a2-42a0-951d-6112c61938ed	25833155-96ba-4795-a8fe-3cb30d6870d8	cf08a4ef-a199-488c-86a5-f1422ea293a6	Add parser strategy registry with deterministic fallbacks per source format	Replace one-size-fits-all fallback parsing with a registry of format-specific deterministic parsers.	done	medium	high	{}	\N	\N	2026-03-09 19:47:11.354023	2026-03-09 16:54:41.198391	2026-03-09 19:47:11.354023
688454b1-b80a-4507-92e3-279bf160827d	25833155-96ba-4795-a8fe-3cb30d6870d8	cfda0ef3-a905-4aed-9d2b-cfca15246391	Add canonicalization rules for owner names, unit identifiers, addresses, and contact variants	Normalize ambiguous source tokens into stable forms while retaining source traceability.	done	medium	high	{}	\N	\N	2026-03-09 19:47:11.354023	2026-03-09 16:54:41.198391	2026-03-09 19:47:11.354023
3eb98b0c-1011-4d53-977b-5274e8255cda	a62be175-0e65-4048-b1f3-4ed3dd75339a	936c0526-b7d0-4cc5-ae15-15cae70b57b4	Add delinquency thresholds, notice sequencing, and escalation tracking	Create configurable 30/60/90-style delinquency policy controls linked to communications and balance-aging logic.	done	medium	high	{33d6c580-3ff9-47b9-a074-354ca91f70e2,cb9c62e5-d2bd-441f-907b-fe756ab0309b}	\N	\N	\N	2026-03-14 12:59:58.248534	2026-03-14 12:59:58.324
ace6dc3a-6651-45e2-9ace-fb1dcad37ec4	a62be175-0e65-4048-b1f3-4ed3dd75339a	936c0526-b7d0-4cc5-ae15-15cae70b57b4	Create collections handoff records and aging dashboard	Provide finance and board users a clear aging view plus formal referral tracking when delinquent balances move into collections.	done	medium	medium	{3eb98b0c-1011-4d53-977b-5274e8255cda}	\N	\N	\N	2026-03-14 12:59:58.25254	2026-03-14 12:59:58.326
1470ffeb-9ef4-4783-890a-0fffe782e772	a62be175-0e65-4048-b1f3-4ed3dd75339a	9b37c076-ce1d-4273-95b6-709310f2d808	Add bank statement import and normalization	Support manual bank-statement import first, with normalized transaction records ready for matching against ledger activity.	done	medium	high	{}	\N	\N	\N	2026-03-14 12:59:58.260398	2026-03-14 12:59:58.328
c1163560-a63a-4e08-8adf-64ca579298a0	25833155-96ba-4795-a8fe-3cb30d6870d8	cf08a4ef-a199-488c-86a5-f1422ea293a6	Add source-format detector for tables, address-block rosters, freeform notes, and mixed exports	Classify ingestion source structure before extraction so the engine routes text to the right parser strategy instead of relying on generic row parsing.	done	large	critical	{}	\N	\N	\N	2026-03-09 16:54:41.198391	2026-03-09 17:12:28.258437
3f2e1cc9-51c5-4a48-a052-b4b67beb2b99	25833155-96ba-4795-a8fe-3cb30d6870d8	ac7686a1-fd84-422d-840a-f472a03c1db2	Define hard quality gates that block approval for malformed owner rosters	Reject extraction outputs with invalid units, placeholder names, low contact coverage, or structural corruption before import.	done	medium	critical	{}	\N	\N	\N	2026-03-09 16:54:41.198391	2026-03-09 17:12:28.258437
99eec839-bf7d-4742-9901-b94ead21a60e	25833155-96ba-4795-a8fe-3cb30d6870d8	ac7686a1-fd84-422d-840a-f472a03c1db2	Surface extraction strategy, destination routing, confidence, and warnings in the review workspace	Show operators how the engine interpreted the source and why the data is headed to a specific module.	done	medium	high	{}	\N	\N	\N	2026-03-09 16:54:41.198391	2026-03-09 17:12:28.258437
692b0f76-03d7-4df8-8e94-283c17e8c0da	25833155-96ba-4795-a8fe-3cb30d6870d8	11d9bf83-ee92-4032-a0b9-c05ef729b2aa	Inject tenant-specific context such as known units, buildings, and prior owners into extraction and matching	Ground extraction in the selected association so the engine contextualizes source content to the platform instead of processing it in isolation.	in-progress	large	critical	{}	\N	\N	\N	2026-03-09 16:54:41.198391	2026-03-09 17:12:28.303642
f317d935-0a30-40e4-83d3-92b8f3a8c1a1	25833155-96ba-4795-a8fe-3cb30d6870d8	ac7686a1-fd84-422d-840a-f472a03c1db2	Add guided remediation flows for unmatched units, split-owner rows, and conflicting contact facts	Let managers and boards repair the normalized data without editing raw JSON blindly.	done	large	high	{}	\N	\N	\N	2026-03-09 16:54:41.198391	2026-03-09 17:47:18.79797
2f48d5a2-09ba-49bd-903f-68fdea2f1d86	25833155-96ba-4795-a8fe-3cb30d6870d8	6f29dc92-839d-4e56-b03e-33effe42e608	Expand ingestion telemetry with provider failures, parser fallbacks, quality warnings, and approval outcomes	Give operators and engineers direct visibility into where ingestion fails and how often.	done	medium	high	{}	\N	\N	2026-03-09 19:47:11.354023	2026-03-09 16:54:41.198391	2026-03-09 19:47:11.354023
8c304def-4d98-43e0-940e-907762609631	7e5b4164-9714-412b-91a2-14ff5c5b55d6	037a31b4-ff27-434a-9d19-3ef8fd273432	Configure durable express-session storage in PostgreSQL	Replace implicit header-based auth for browser flows with server sessions persisted in Postgres using connect-pg-simple and environment-safe cookie settings.	done	large	critical	{}	\N	\N	2026-03-12 18:09:07.23	2026-03-12 17:56:54.108514	2026-03-12 18:09:07.23
9bc1bd5f-3dee-4079-a4b0-0ae466c4da61	7e5b4164-9714-412b-91a2-14ff5c5b55d6	ec89263a-3b48-4de7-b3b1-5a4058141e0c	Implement account resolution and linking rules	On callback, resolve user by external Google ID first, fallback to email match, then link existing users or create new internal users from profile data.	done	large	critical	{}	\N	\N	2026-03-12 18:11:13.481	2026-03-12 17:56:54.234483	2026-03-12 18:11:13.481
3fcfea7e-ea06-471e-8084-7f52b003d4a7	7e5b4164-9714-412b-91a2-14ff5c5b55d6	ec89263a-3b48-4de7-b3b1-5a4058141e0c	Serialize internal user ID into session and hydrate on request	Store only internal user ID in session; deserialize to full user object from database for authenticated request context.	done	medium	high	{}	\N	\N	2026-03-12 18:11:13.489	2026-03-12 17:56:54.238494	2026-03-12 18:11:13.489
6a369c71-06c5-4548-bd28-26e7167c7053	7e5b4164-9714-412b-91a2-14ff5c5b55d6	ec89263a-3b48-4de7-b3b1-5a4058141e0c	Add Passport Google OAuth strategy and auth routes	Implement /auth/google and /auth/google/callback with profile+email scopes and backend OAuth code exchange using Google client credentials.	done	large	critical	{}	\N	\N	2026-03-12 18:11:13.493	2026-03-12 17:56:54.118035	2026-03-12 18:11:13.493
460615fd-0b43-407c-ab37-234ef50cf366	7e5b4164-9714-412b-91a2-14ff5c5b55d6	777d3f7a-1b89-4519-9790-edf15f3573ef	Implement callback completion handshake to main app window	After OAuth callback, notify primary app context of login success and reload into authenticated state.	done	medium	high	{}	\N	\N	2026-03-12 18:12:21.808	2026-03-12 17:56:54.25206	2026-03-12 18:12:21.808
cf35ee5c-4cb2-42c7-8c6a-8027d625c952	7e5b4164-9714-412b-91a2-14ff5c5b55d6	777d3f7a-1b89-4519-9790-edf15f3573ef	Build frontend Google launch flow (redirect or popup/new tab)	Start auth via backend endpoint and support account-selection prompts plus popup/new-tab completion for embedded/preview browser constraints.	done	medium	high	{}	\N	\N	2026-03-12 18:12:21.812	2026-03-12 17:56:54.247414	2026-03-12 18:12:21.812
1af1d47b-a791-4008-b112-3c8f03922b79	7e5b4164-9714-412b-91a2-14ff5c5b55d6	777d3f7a-1b89-4519-9790-edf15f3573ef	Add session-restoration fallback token flow	Store short-lived encoded auth payload post-login and allow backend validation endpoint to recreate session only when normal session checks fail.	done	large	high	{}	\N	\N	2026-03-12 18:13:40.302	2026-03-12 17:56:54.25941	2026-03-12 18:13:40.302
e5f7b50b-eaea-4155-a2aa-e0a023d9c1f6	7e5b4164-9714-412b-91a2-14ff5c5b55d6	7981e3fa-6454-46cc-9aa4-50cbcef6560f	Auto-provision default workspace/tenant membership on first login	If a first-time authenticated user has no business/workspace membership, create a default workspace context and grant owner-level access.	done	medium	high	{}	\N	\N	2026-03-12 18:14:41.633	2026-03-12 17:56:54.266511	2026-03-12 18:14:41.633
bf16d6b6-417f-41af-8205-ccc1ee2c47e7	7e5b4164-9714-412b-91a2-14ff5c5b55d6	7981e3fa-6454-46cc-9aa4-50cbcef6560f	Add resilient auth middleware for protected APIs	Guard routes with Passport session checks and include recovery logic for partially hydrated request/session state.	done	medium	high	{}	\N	\N	2026-03-12 18:15:58.992	2026-03-12 17:56:54.269581	2026-03-12 18:15:58.992
bd903d29-5ef8-4e19-80eb-0b45713abac5	7e5b4164-9714-412b-91a2-14ff5c5b55d6	7981e3fa-6454-46cc-9aa4-50cbcef6560f	Implement complete logout cleanup	Clear Passport login state, destroy server session, clear cookie, and remove client-side session-recovery artifacts.	done	small	high	{}	\N	\N	2026-03-12 18:16:52.133	2026-03-12 17:56:54.272913	2026-03-12 18:16:52.133
2507b3ba-8981-42f0-9cd0-1e625d9ae112	7e5b4164-9714-412b-91a2-14ff5c5b55d6	427d9f2d-e9e1-4966-9cee-20adb8cf269b	Map OAuth-authenticated users to admin roles/scopes	Integrate session-authenticated internal users with current admin role and association-scope authorization rules.	done	medium	critical	{}	\N	\N	2026-03-12 18:17:05.961	2026-03-12 17:56:54.283248	2026-03-12 18:17:05.961
53dade96-f882-4586-92c4-acb6464cbf53	7e5b4164-9714-412b-91a2-14ff5c5b55d6	427d9f2d-e9e1-4966-9cee-20adb8cf269b	Define transitional coexistence of API-key and session auth	Support controlled migration period where legacy admin API-key flows coexist with session auth, then remove header-key reliance.	done	medium	high	{}	\N	\N	2026-03-12 18:17:05.965	2026-03-12 17:56:54.27964	2026-03-12 18:17:05.965
733380e2-2752-49ed-8854-97d9a5cc0d3c	7e5b4164-9714-412b-91a2-14ff5c5b55d6	427d9f2d-e9e1-4966-9cee-20adb8cf269b	Run production-readiness verification and rollback plan	Verify login, callback, session persistence, route protection, logout, and recovery paths across local and hosted environments with rollback playbook.	done	medium	high	{}	\N	\N	2026-03-12 18:22:15.509	2026-03-12 17:56:54.287252	2026-03-12 18:22:15.509
97397c10-f248-49c4-b99c-0183a8607d43	a62be175-0e65-4048-b1f3-4ed3dd75339a	bca90253-11f8-4420-9ce7-a6462c8ae039	Implement live provider verification and secure credential storage	Replace structural-only gateway validation with a real provider connectivity check and move secrets into a production-safe handling path.	todo	large	critical	{}	\N	\N	\N	2026-03-14 12:59:58.16732	2026-03-14 12:59:58.292
b5c3dfe5-63bd-491d-859d-277ea458eb8c	afd38fb0-c594-4b57-8151-397146ab973d	43266a06-9df9-42ac-8476-4be649b5b90f	Implement role-based navigation and dashboard view	Treasurer role should lead with Finance. President role should lead with Governance. Manager role should see all. Currently every role sees an identical 6-section sidebar with 20+ items.\n\n**Self-managed:** A secretary who only manages meeting minutes is overwhelmed by financial forms and payment gateway setup.	done	medium	high	{}	\N	\N	\N	2026-03-17 01:44:01.622292	2026-03-17 01:44:01.622292
4c72dc40-290c-422f-ab15-80321fbfa839	afd38fb0-c594-4b57-8151-397146ab973d	43266a06-9df9-42ac-8476-4be649b5b90f	Add portfolio-level health summary for property managers	Professional property managers need a cross-association view: collection rates by property, open work orders by priority, compliance gaps, upcoming meeting deadlines. The current dashboard forces them to context-switch per association with no aggregate view.	done	medium	high	{}	\N	\N	\N	2026-03-17 01:44:01.629229	2026-03-17 01:44:01.629229
0cb4d98c-fd71-4745-81ca-ac01c303643c	91b9fef3-9fd7-418e-b306-6fb0c6118b9a	9399946a-f5ff-49f2-b497-afadca4d085c	Upgrade portal maintenance submission with categories, urgency, and photo evidence	Expand the current request form so owners and tenants can submit more structured issues that are ready for triage and operational routing.	done	medium	high	{}	\N	\N	2026-03-14 14:10:10.578348	2026-03-14 13:02:30.041058	2026-03-14 14:10:10.578348
7c65f03b-dd02-45b2-b29f-082e7ed6536b	91b9fef3-9fd7-418e-b306-6fb0c6118b9a	9e734dc9-fde1-433a-a9f5-417d77691cd1	Connect vendor records to invoices and future work orders	Replace free-text vendor references where possible so invoices and work orders can roll up against a consistent vendor identity.	done	medium	high	{cda7b3f9-5d0d-4963-822e-5f1ab7a0abbc}	\N	\N	2026-03-14 13:56:30.64262	2026-03-14 13:02:30.012929	2026-03-14 13:56:30.64262
3ee1f398-55a1-4c90-a604-acc37748406a	91b9fef3-9fd7-418e-b306-6fb0c6118b9a	3090173b-6725-4682-9a50-e597986dc786	Link completed work orders to vendor invoices and expenses	Tie maintenance delivery to actual spend so boards can trace operational work from request through invoice and payment.	done	medium	high	{7c65f03b-dd02-45b2-b29f-082e7ed6536b,20003783-8c8e-49c6-be8a-71e331ffdbf9}	\N	\N	2026-03-14 14:02:39.037207	2026-03-14 13:02:30.029002	2026-03-14 14:02:39.037207
548f99c0-f6a6-4596-b247-711287b9e3d3	a62be175-0e65-4048-b1f3-4ed3dd75339a	9b37c076-ce1d-4273-95b6-709310f2d808	Deliver AR aging, income and expense, reserve, and exportable board reports	Generate board-ready financial views and export outputs directly from platform data rather than spreadsheet-only workflows.	done	large	high	{ace6dc3a-6651-45e2-9ace-fb1dcad37ec4,5efc1087-5ecc-4b96-ba24-9d8d6bd5d269}	\N	\N	\N	2026-03-14 12:59:58.271628	2026-03-14 12:59:58.339
cd4f453e-0f6a-4b98-9178-b73d4b907d6d	a62be175-0e65-4048-b1f3-4ed3dd75339a	bca90253-11f8-4420-9ce7-a6462c8ae039	Create admin payment activity and exception review view	Give admins a dedicated operational view of payment attempts, webhook outcomes, posting status, and exceptions tied back to the owner ledger.	done	medium	high	{b2418d78-e99a-4031-b0ab-b5cb8153298d,680b90e1-4932-400e-a353-bb84aaa41990}	\N	\N	\N	2026-03-14 12:59:58.19345	2026-03-14 12:59:58.302
fb609bee-ce19-4664-a595-30ca649e29ae	a62be175-0e65-4048-b1f3-4ed3dd75339a	9b37c076-ce1d-4273-95b6-709310f2d808	Build reconciliation match queue and manual review workflow	Auto-match bank transactions to ledger entries by amount, date, and reference, then surface unresolved items for operator review.	done	large	high	{1470ffeb-9ef4-4783-890a-0fffe782e772,cd4f453e-0f6a-4b98-9178-b73d4b907d6d}	\N	\N	\N	2026-03-14 12:59:58.264361	2026-03-14 12:59:58.332
5efc1087-5ecc-4b96-ba24-9d8d6bd5d269	a62be175-0e65-4048-b1f3-4ed3dd75339a	9b37c076-ce1d-4273-95b6-709310f2d808	Add reconciliation period close controls and edit locks	Prevent retroactive mutation of closed finance periods once reconciliation is completed and approved.	done	medium	high	{fb609bee-ce19-4664-a595-30ca649e29ae}	\N	\N	\N	2026-03-14 12:59:58.268605	2026-03-14 12:59:58.335
e45cc349-a831-4825-808c-250d474029b7	91b9fef3-9fd7-418e-b306-6fb0c6118b9a	9e734dc9-fde1-433a-a9f5-417d77691cd1	Link vendor documents, insurance certificates, and contracts	Attach W-9s, insurance certificates, contracts, and other supporting files to vendor profiles using the existing document repository patterns.	done	medium	high	{cda7b3f9-5d0d-4963-822e-5f1ab7a0abbc}	\N	\N	2026-03-14 13:49:32.049686	2026-03-14 13:02:29.992636	2026-03-14 13:49:32.049686
407c0e35-850c-4a04-ade1-0918bf94979f	a62be175-0e65-4048-b1f3-4ed3dd75339a	492bb38a-b0f1-4ca1-962a-c89d16ddeced	Expand audit coverage, alerts, and finance-grade error handling	Capture critical payment and reconciliation actions in audit logs, add operator alerts, and harden failure paths for finance operations.	done	medium	high	{680b90e1-4932-400e-a353-bb84aaa41990,fb609bee-ce19-4664-a595-30ca649e29ae}	\N	\N	\N	2026-03-14 12:59:58.27874	2026-03-14 12:59:58.342
cb9c62e5-d2bd-441f-907b-fe756ab0309b	a62be175-0e65-4048-b1f3-4ed3dd75339a	936c0526-b7d0-4cc5-ae15-15cae70b57b4	Build recurring charge runner with retry controls	Initiate scheduled charges from fee obligations, track retry state, and prevent duplicate postings on retries or replays.	done	large	high	{7050e672-6e4c-4d13-89eb-6c1cd66aee82,680b90e1-4932-400e-a353-bb84aaa41990}	\N	\N	\N	2026-03-14 12:59:58.244864	2026-03-14 12:59:58.321
4bed564c-90df-4e5e-9301-144fbd770afb	a62be175-0e65-4048-b1f3-4ed3dd75339a	492bb38a-b0f1-4ca1-962a-c89d16ddeced	Add staged rollout controls by association	Release the payment stack behind association-scoped controls so the rollout can be canaried before full activation.	done	medium	medium	{b2418d78-e99a-4031-b0ab-b5cb8153298d}	\N	\N	\N	2026-03-14 12:59:58.282423	2026-03-14 12:59:58.345
2334e6fe-87b4-4fca-bb6a-247da1002d9d	a62be175-0e65-4048-b1f3-4ed3dd75339a	492bb38a-b0f1-4ca1-962a-c89d16ddeced	Create acceptance coverage for payment success, failure, retry, and reconciliation scenarios	Establish verification coverage across the operational states that matter before the feature is called production-ready.	done	medium	high	{548f99c0-f6a6-4596-b247-711287b9e3d3,407c0e35-850c-4a04-ade1-0918bf94979f}	\N	\N	\N	2026-03-14 12:59:58.285836	2026-03-14 12:59:58.348
a0ed36f9-c45f-429a-ab68-cb10e16c981e	a62be175-0e65-4048-b1f3-4ed3dd75339a	492bb38a-b0f1-4ca1-962a-c89d16ddeced	Prepare operator runbook, cutover plan, and launch KPIs	Document finance operations, launch gates, rollback considerations, and the KPI set used to judge post-release stability.	done	small	medium	{2334e6fe-87b4-4fca-bb6a-247da1002d9d,4bed564c-90df-4e5e-9301-144fbd770afb}	\N	\N	\N	2026-03-14 12:59:58.290196	2026-03-14 12:59:58.351
5d79b6a7-26b5-4cff-a0a6-a08e522ed131	91b9fef3-9fd7-418e-b306-6fb0c6118b9a	6d6633bd-7e42-4a62-8cc0-e7e260fb0994	Add inspection records with findings, photos, and severity	Create structured inspection records for units and common areas, including evidentiary attachments and issue findings.	done	large	high	{}	\N	\N	2026-03-14 14:30:57.037	2026-03-14 13:02:30.06619	2026-03-14 14:30:57.037
50a7014b-3277-4415-9d87-3fa3581562ab	91b9fef3-9fd7-418e-b306-6fb0c6118b9a	6d6633bd-7e42-4a62-8cc0-e7e260fb0994	Convert inspection findings into follow-up work orders	Allow open findings to become actionable work items without duplicate data entry.	done	medium	medium	{5d79b6a7-26b5-4cff-a0a6-a08e522ed131,20003783-8c8e-49c6-be8a-71e331ffdbf9}	\N	\N	2026-03-14 14:30:57.037	2026-03-14 13:02:30.06958	2026-03-14 14:30:57.037
00f2354d-2f62-4512-9a6d-2fe32a4161fa	91b9fef3-9fd7-418e-b306-6fb0c6118b9a	6d6633bd-7e42-4a62-8cc0-e7e260fb0994	Create preventive maintenance templates and schedule generation	Support recurring maintenance plans by component, frequency, responsibility, and due-date generation.	done	large	high	{}	\N	\N	2026-03-14 14:39:29.273	2026-03-14 13:02:30.059355	2026-03-14 14:39:29.273
d2af9237-4226-4b90-a939-cf1962a880ad	91b9fef3-9fd7-418e-b306-6fb0c6118b9a	fe54145e-6c20-4476-96bf-25fdb280fa90	Create operations dashboard for open work, aging, and vendor activity	Give admins and boards a high-level view of open requests, work-order aging, vendor load, and unresolved inspection items.	done	medium	high	{35aebfb7-73d7-4ea5-8eb8-fdc84e4e18ba,50a7014b-3277-4415-9d87-3fa3581562ab}	\N	\N	2026-03-14 14:45:44.055	2026-03-14 13:02:30.076541	2026-03-14 14:45:44.055
b568a1df-e491-4841-bc22-4b6f2eb1c292	91b9fef3-9fd7-418e-b306-6fb0c6118b9a	fe54145e-6c20-4476-96bf-25fdb280fa90	Add exportable maintenance and vendor reporting	Produce board-ready and operational exports for vendor activity, work-order cost, response performance, and recurring maintenance coverage.	done	medium	medium	{d2af9237-4226-4b90-a939-cf1962a880ad,3ee1f398-55a1-4c90-a604-acc37748406a}	\N	\N	2026-03-14 14:48:34.804	2026-03-14 13:02:30.079894	2026-03-14 14:48:34.804
cac9d3d4-9a6f-4747-ad58-258bb9e53c76	91b9fef3-9fd7-418e-b306-6fb0c6118b9a	6d6633bd-7e42-4a62-8cc0-e7e260fb0994	Link preventive schedules to work-order creation	Allow due preventive tasks to generate work orders automatically or through operator confirmation.	done	medium	high	{00f2354d-2f62-4512-9a6d-2fe32a4161fa,20003783-8c8e-49c6-be8a-71e331ffdbf9}	\N	\N	2026-03-14 14:39:29.273	2026-03-14 13:02:30.063319	2026-03-14 14:39:29.273
e7529daf-45af-400f-84a1-15b9ba0862ed	91b9fef3-9fd7-418e-b306-6fb0c6118b9a	fe54145e-6c20-4476-96bf-25fdb280fa90	Expand audit logging and permissions for property operations	Ensure work assignments, status changes, inspection edits, and vendor record updates are permissioned and auditable.	done	medium	high	{20003783-8c8e-49c6-be8a-71e331ffdbf9,5d79b6a7-26b5-4cff-a0a6-a08e522ed131,cda7b3f9-5d0d-4963-822e-5f1ab7a0abbc}	\N	\N	2026-03-14 14:50:09.774	2026-03-14 13:02:30.083911	2026-03-14 14:50:09.774
dedc37c1-1091-46b5-aabb-2999a47aaf94	91b9fef3-9fd7-418e-b306-6fb0c6118b9a	fe54145e-6c20-4476-96bf-25fdb280fa90	Prepare rollout checklist, operator training, and acceptance verification	Define cutover steps, acceptance checks, and operator guidance before rolling property operations into live association usage.	done	small	medium	{b568a1df-e491-4841-bc22-4b6f2eb1c292,e7529daf-45af-400f-84a1-15b9ba0862ed,e70508bc-ef02-487e-afb8-ac3856b0ef5c,cac9d3d4-9a6f-4747-ad58-258bb9e53c76}	\N	\N	2026-03-14 14:50:51.186	2026-03-14 13:02:30.087791	2026-03-14 14:50:51.186
41a68e14-b538-42ff-8f43-9c52b0fa9eea	b6c2d9d5-3780-496f-b957-0a6b2da15da6	0c78fc58-df34-48e9-9a0a-a95ee50bba03	ISS-037 Investigate zero-result regulatory library sync	Verify the regulatory data source and extraction pipeline so compliance rule sync returns actual records instead of zero results.	done	medium	medium	{a29e3b30-3e5d-4c19-b2b7-eb43e34db286}	2026-03-30 00:00:00	2026-04-10 00:00:00	2026-03-16 16:10:20.95238	2026-03-16 14:20:26.520537	2026-03-16 16:10:20.95238
cda7b3f9-5d0d-4963-822e-5f1ab7a0abbc	91b9fef3-9fd7-418e-b306-6fb0c6118b9a	9e734dc9-fde1-433a-a9f5-417d77691cd1	Create vendor profile model, API, and admin workspace	Introduce structured vendor records with trade, contact data, service area, licensing, and association linkage instead of invoice-only vendor names.	done	large	high	{}	\N	\N	2026-03-14 13:49:32.049686	2026-03-14 13:02:29.97813	2026-03-14 13:49:32.049686
0b67e0e7-3b81-4a0a-b727-a96267aac424	91b9fef3-9fd7-418e-b306-6fb0c6118b9a	9e734dc9-fde1-433a-a9f5-417d77691cd1	Add vendor status tracking and renewal alerts	Track active and inactive vendors, insurance expiration, and missing compliance artifacts so operators can identify vendor risk before assignment.	done	medium	medium	{e45cc349-a831-4825-808c-250d474029b7}	\N	\N	2026-03-14 13:49:32.049686	2026-03-14 13:02:29.997395	2026-03-14 13:49:32.049686
20003783-8c8e-49c6-be8a-71e331ffdbf9	91b9fef3-9fd7-418e-b306-6fb0c6118b9a	3090173b-6725-4682-9a50-e597986dc786	Create work-order model, lifecycle states, and admin operations UI	Introduce work-order records with scope, location, priority, assignee, estimated cost, and lifecycle states from open through closed.	done	large	critical	{}	\N	\N	2026-03-14 13:56:30.64262	2026-03-14 13:02:30.021152	2026-03-14 13:56:30.64262
e9ea0756-09fe-4f5d-bcf8-62e6834c4291	91b9fef3-9fd7-418e-b306-6fb0c6118b9a	3090173b-6725-4682-9a50-e597986dc786	Convert maintenance requests into managed work orders	Bridge the existing maintenance-request intake flow into the new work-order lifecycle so requests no longer stop at triage-only handling.	done	medium	high	{20003783-8c8e-49c6-be8a-71e331ffdbf9}	\N	\N	2026-03-14 13:56:30.64262	2026-03-14 13:02:30.024971	2026-03-14 13:56:30.64262
35aebfb7-73d7-4ea5-8eb8-fdc84e4e18ba	91b9fef3-9fd7-418e-b306-6fb0c6118b9a	3090173b-6725-4682-9a50-e597986dc786	Add unit-level maintenance history and operational timeline	Expose historical work by unit and common area so recurring issues and prior remediation are visible in context.	done	medium	medium	{e9ea0756-09fe-4f5d-bcf8-62e6834c4291,3ee1f398-55a1-4c90-a604-acc37748406a}	\N	\N	2026-03-14 14:02:39.037207	2026-03-14 13:02:30.033237	2026-03-14 14:02:39.037207
f3302fec-e65b-4a2b-9238-39aa2409bb8c	91b9fef3-9fd7-418e-b306-6fb0c6118b9a	9399946a-f5ff-49f2-b497-afadca4d085c	Add request and work-order status notifications	Notify submitters at key lifecycle transitions such as triaged, assigned, in progress, resolved, and closed using the communications layer.	done	medium	medium	{e9ea0756-09fe-4f5d-bcf8-62e6834c4291,0cb4d98c-fd71-4745-81ca-ac01c303643c}	\N	\N	2026-03-14 14:10:10.578348	2026-03-14 13:02:30.044569	2026-03-14 14:10:10.578348
0da965a1-83e9-4215-bc63-8316d597a9ee	91b9fef3-9fd7-418e-b306-6fb0c6118b9a	9399946a-f5ff-49f2-b497-afadca4d085c	Add portal history view for resident maintenance submissions	Give owners and tenants visibility into their prior requests, current status, and resolution notes.	done	medium	medium	{0cb4d98c-fd71-4745-81ca-ac01c303643c,f3302fec-e65b-4a2b-9238-39aa2409bb8c}	\N	\N	2026-03-14 14:10:10.578348	2026-03-14 13:02:30.048062	2026-03-14 14:10:10.578348
e70508bc-ef02-487e-afb8-ac3856b0ef5c	91b9fef3-9fd7-418e-b306-6fb0c6118b9a	9399946a-f5ff-49f2-b497-afadca4d085c	Add SLA timers and escalation rules for urgent requests	Track response windows and escalation triggers so urgent issues are surfaced when operational response lags.	done	medium	medium	{f3302fec-e65b-4a2b-9238-39aa2409bb8c}	\N	\N	2026-03-14 14:10:10.578348	2026-03-14 13:02:30.05215	2026-03-14 14:10:10.578348
0c2a6ddc-26d0-4ce3-9f4e-3e34d8101c5b	afd38fb0-c594-4b57-8151-397146ab973d	52e2ea28-5058-46f2-90fa-c403fc8f28ee	Fix budget setup UX — simplify triple-dropdown selection	Budget page requires 3 cascading dropdowns (Association → Budget → Version) before any data is shown. Streamline to default to the current/active budget for the selected association with a clear 'select different budget' option. Also add inline explanations of version statuses (what does 'proposed' mean for a board?).\n\n**Self-managed:** This is the top abandonment point in the financial module.	done	small	high	{}	\N	\N	\N	2026-03-17 01:44:01.652698	2026-03-17 02:12:15.355482
fd5e641e-c1d2-40d0-a42b-cd9bd4529828	afd38fb0-c594-4b57-8151-397146ab973d	52e2ea28-5058-46f2-90fa-c403fc8f28ee	Add automated late fee application workflow	Late fee rules exist in the system but are never automatically applied. The grace days field on fee schedules is also disconnected from late fee rules. Build an automation that: applies late fees after grace period, creates ledger entries, and queues payment reminder notices.\n\n**PM perspective:** Manual late fee posting across 100+ units in multiple associations is not scalable.	done	large	high	{}	\N	\N	\N	2026-03-17 01:44:01.642105	2026-03-17 02:16:15.117637
e1737c2c-c4f5-4a5d-b8cb-5b226e037d95	afd38fb0-c594-4b57-8151-397146ab973d	52e2ea28-5058-46f2-90fa-c403fc8f28ee	Build accounts payable workflow for vendor invoices	Vendor invoices are tracked (draft → received → approved → paid) but there's no: payment scheduling, check request workflow, approval routing, or bank reconciliation. Add an AP workflow where invoices can be flagged for payment, approved by board, and marked paid with check number.\n\n**PM perspective:** This is a gap that forces parallel spreadsheet tracking.\n**Self-managed:** Treasurer needs a simple 'invoices to pay this month' view.	done	large	high	{}	\N	\N	\N	2026-03-17 01:44:01.648898	2026-03-17 02:18:00.070159
7ebbb7be-30ef-49af-85bb-0c8b05f97fbb	38b68bc4-7837-448e-981f-bcd55aca5bef	066b37f4-813e-4965-98f7-8d1e4d032927	Specify association and unit binding, duplicate matching, and approval rules	Set the rules for unit-specific links, token scope, person matching, and when submissions require admin approval before touching core records.	done	medium	high	{}	\N	\N	2026-03-14 15:31:22.965369	2026-03-14 14:45:38.468207	2026-03-14 15:31:22.965369
08b6a6bc-0257-43c4-8dac-623d16858e90	38b68bc4-7837-448e-981f-bcd55aca5bef	066b37f4-813e-4965-98f7-8d1e4d032927	Define required fields and evidence by resident type	Decide what owner and tenant forms must collect, which fields are optional, and what supporting data is needed before activation.	done	small	medium	{}	\N	\N	2026-03-14 15:31:22.965369	2026-03-14 14:45:38.468207	2026-03-14 15:31:22.965369
427fea5a-b09c-423d-ba6d-1deca0c93a6f	38b68bc4-7837-448e-981f-bcd55aca5bef	7a6e5849-86bb-47ff-8198-1bdb9b1bba73	Send invite communications using existing contact information	Allow the admin to invite known emails or phone numbers before a formal person record exists in the association.	done	medium	high	{}	\N	\N	\N	2026-03-14 14:45:38.468207	2026-03-14 15:02:55.185099
d8480e1e-a4cd-4e54-9baf-e911770515b4	38b68bc4-7837-448e-981f-bcd55aca5bef	62c67e19-22e7-439d-a266-d91369f549ca	Define merge path into persons, ownerships, occupancies, and portal access	Implement the approved write path so accepted submissions become durable platform records without breaking existing constraints.	done	large	critical	{}	\N	\N	2026-03-14 15:31:22.965369	2026-03-14 14:45:38.468207	2026-03-14 15:31:22.965369
a29e3b30-3e5d-4c19-b2b7-eb43e34db286	b6c2d9d5-3780-496f-b957-0a6b2da15da6	0c78fc58-df34-48e9-9a0a-a95ee50bba03	ISS-036 Fix governance task creation failures	Investigate governance task submission errors so new governance tasks can be saved successfully.	done	medium	high	{110d6200-73f2-4943-97b5-57dd74ee1ec2}	2026-03-16 00:00:00	2026-03-27 00:00:00	2026-03-16 14:39:16.404	2026-03-16 14:20:26.516313	2026-03-16 14:20:26.516313
5c974ba8-4088-4754-aabf-fccd73b090b9	38b68bc4-7837-448e-981f-bcd55aca5bef	7a6e5849-86bb-47ff-8198-1bdb9b1bba73	Support bulk invitation runs and reminder cadences	Enable association-wide outreach for unclaimed units and resend logic for uncompleted intake.	done	medium	medium	{}	\N	\N	\N	2026-03-14 14:45:38.468207	2026-03-14 15:04:40.972313
b010c930-9f95-4f33-8659-b28d6ba4dfd3	38b68bc4-7837-448e-981f-bcd55aca5bef	7a6e5849-86bb-47ff-8198-1bdb9b1bba73	Track outreach funnel metrics by association and unit	Measure sent, opened, clicked, started, submitted, approved, and activated states to identify onboarding gaps.	done	medium	medium	{}	\N	\N	\N	2026-03-14 14:45:38.468207	2026-03-14 15:04:40.972313
e1a0395e-abd8-4314-b7ea-7faa5680e085	130614dc-fe17-427c-bc29-dd957cf3c797	96384569-2d06-4277-b2a2-4125604fb955	Add scheduled board package generation	Generate board packages automatically relative to meeting cadence and package schedule rules.	done	medium	high	{8b8d173a-276c-4bed-8a96-d52698a1ced8}	\N	\N	2026-03-14 15:05:16.287158	2026-03-14 14:52:01.731151	2026-03-14 15:05:16.287158
a67d093a-6bba-4010-a5e1-f567213f4f6d	38b68bc4-7837-448e-981f-bcd55aca5bef	066b37f4-813e-4965-98f7-8d1e4d032927	Define onboarding states and intake modes for owners and tenants	Document how empty-association onboarding starts, what manual versus self-service means, and which flows create ownership versus occupancy.	done	medium	high	{}	\N	\N	\N	2026-03-14 14:45:38.468207	2026-03-14 15:18:52.362447
50f82a13-97a6-45ca-975b-039a88488ee8	38b68bc4-7837-448e-981f-bcd55aca5bef	6b73926a-a6d0-40e4-842f-78d70d90cfc8	Allow manual owner and tenant entry directly from unit context	Reduce friction for admins who need to create persons, ownerships, or occupancies without waiting for outreach.	done	medium	high	{}	\N	\N	\N	2026-03-14 14:45:38.468207	2026-03-14 15:21:41.478158
c43b4afe-cafb-4b19-b4ff-aa53a8fafa4c	38b68bc4-7837-448e-981f-bcd55aca5bef	1dbf100f-a63a-4953-a085-45fdc41f8470	Support rejection, change requests, and audit history	Record reviewer actions, preserve submission history, and allow communication back to the submitter when corrections are needed.	done	medium	high	{}	\N	\N	\N	2026-03-14 14:45:38.468207	2026-03-14 15:23:48.76744
eb6393a4-e745-461f-94ea-43d32bd42258	b6c2d9d5-3780-496f-b957-0a6b2da15da6	953b8170-1993-4f36-bc24-06599caf72fa	ISS-018 Repair onboarding review and open actions on the dashboard	Connect onboarding review controls so dashboard actions open the intended review interface instead of failing silently.	done	medium	high	{f47eafe3-dc98-4055-b7c9-a83629f05245}	2026-03-16 00:00:00	2026-03-27 00:00:00	2026-03-16 15:28:08.021931	2026-03-16 14:06:37.669896	2026-03-16 15:28:08.021931
dce5ee24-8c75-4e46-96f9-00111eb173ce	b6c2d9d5-3780-496f-b957-0a6b2da15da6	0c78fc58-df34-48e9-9a0a-a95ee50bba03	ISS-038 Add contextual examples to governance task creation	Provide examples and field descriptions so governance task setup is understandable without prior product knowledge.	done	small	medium	{a29e3b30-3e5d-4c19-b2b7-eb43e34db286}	2026-03-30 00:00:00	2026-04-10 00:00:00	2026-03-16 15:11:37.122816	2026-03-16 14:20:26.523881	2026-03-16 15:11:37.122816
e149c15a-dd74-4772-9530-b94804472437	130614dc-fe17-427c-bc29-dd957cf3c797	e0178afe-8b3f-444b-ae19-b1b89a772933	Create portfolio overview KPI dashboard	Show key association-level KPIs side by side across the portfolio, including collections, delinquency, compliance health, and operations load.	done	medium	medium	{}	\N	\N	\N	2026-03-14 14:52:01.831563	2026-03-14 14:52:01.889
06fb1369-8615-4576-bbdc-d2f46b294d5b	130614dc-fe17-427c-bc29-dd957cf3c797	96384569-2d06-4277-b2a2-4125604fb955	Distribute approved packages through the communications layer	Send finalized packages to board recipients with traceable distribution records and version-safe attachments or links.	done	medium	medium	{270330c3-d1c2-4882-98d9-9a857840020e}	\N	\N	2026-03-14 15:18:47.935913	2026-03-14 14:52:01.741755	2026-03-14 15:18:47.935913
c006a0ae-4324-4ffc-94c5-96c46f505a72	130614dc-fe17-427c-bc29-dd957cf3c797	edaba9a1-e82b-4c4f-ba15-f1798ef9d61f	Add dues collection rate analytics	Calculate and visualize rolling collection performance against posted charges over time.	done	medium	high	{}	\N	\N	2026-03-14 15:23:40.214516	2026-03-14 14:52:01.751198	2026-03-14 15:23:40.214516
88191c30-1d64-4e60-baae-78df319779d9	130614dc-fe17-427c-bc29-dd957cf3c797	edaba9a1-e82b-4c4f-ba15-f1798ef9d61f	Add delinquency trend and aging movement analysis	Track changes in aged receivables month-over-month so boards can see whether collections performance is improving or degrading.	done	medium	high	{}	\N	\N	2026-03-14 15:30:28.13264	2026-03-14 14:52:01.756397	2026-03-14 15:30:28.13264
c21fcb7e-6a02-4ab3-8cd0-e83f2443290c	130614dc-fe17-427c-bc29-dd957cf3c797	edaba9a1-e82b-4c4f-ba15-f1798ef9d61f	Build reserve fund projection model	Project reserve balance under current contribution and expense assumptions across multiple forecast windows.	done	large	medium	{}	\N	\N	2026-03-14 15:38:58.852348	2026-03-14 14:52:01.760638	2026-03-14 15:38:58.852348
15a8e6fe-4cc6-4d86-9267-f2621c757c20	130614dc-fe17-427c-bc29-dd957cf3c797	edaba9a1-e82b-4c4f-ba15-f1798ef9d61f	Add expense category trend visualization	Compare actual expense movement by category and period against historical and budget baselines.	done	medium	medium	{}	\N	\N	2026-03-14 15:43:42.960057	2026-03-14 14:52:01.765667	2026-03-14 15:43:42.960057
28147319-63e6-4696-992b-129915daf77c	130614dc-fe17-427c-bc29-dd957cf3c797	e5c52675-2e16-4e65-b0ac-a7bd6ff60c22	Extract compliance rules from bylaw intelligence artifacts	Turn bylaw clause intelligence into structured obligations that can be evaluated against platform records.	done	large	high	{}	\N	\N	2026-03-14 16:08:51.79054	2026-03-14 14:52:01.775998	2026-03-14 16:08:51.79054
43d2dba4-affd-4100-9c44-1fd64c8a8fc7	130614dc-fe17-427c-bc29-dd957cf3c797	e5c52675-2e16-4e65-b0ac-a7bd6ff60c22	Create compliance alert dashboard with source evidence	Show compliance issues, severity, and supporting source references in a board-facing review dashboard.	done	medium	medium	{d9db804c-7f69-4e3a-89b1-7fd4e4cc1664}	\N	\N	\N	2026-03-14 14:52:01.78667	2026-03-14 14:52:01.874
5b34bfe3-d2af-4d9e-8cfb-3aed50ac33c8	130614dc-fe17-427c-bc29-dd957cf3c797	ca946259-c6d9-4bb5-88af-05b2010be5a6	Create state template library for compliance obligations	Build reusable checklist templates keyed by jurisdiction so associations can start from state-aware defaults.	done	medium	medium	{}	\N	\N	\N	2026-03-14 14:52:01.806659	2026-03-14 14:52:01.879
d9a797a1-a5b5-4063-86c6-25c3597b21ff	130614dc-fe17-427c-bc29-dd957cf3c797	e5c52675-2e16-4e65-b0ac-a7bd6ff60c22	Add compliance alert suppression and override workflow	Allow operators to resolve, suppress, or exempt alerts with traceable rationale and timestamps.	done	medium	medium	{43d2dba4-affd-4100-9c44-1fd64c8a8fc7}	\N	\N	\N	2026-03-14 14:52:01.795799	2026-03-14 14:52:01.877
a31637af-e809-4560-b8d4-964f900010ee	130614dc-fe17-427c-bc29-dd957cf3c797	e0178afe-8b3f-444b-ae19-b1b89a772933	Add comparative benchmarking charts and rankings	Rank and compare associations on configurable metrics so managers can spot outliers quickly.	done	medium	medium	{e149c15a-dd74-4772-9530-b94804472437}	\N	\N	\N	2026-03-14 14:52:01.835597	2026-03-14 14:52:01.892
4d017780-7175-4e21-bf0a-0fe96aa12ab6	130614dc-fe17-427c-bc29-dd957cf3c797	e0178afe-8b3f-444b-ae19-b1b89a772933	Add portfolio-level threshold alerts	Raise portfolio alerts when an association crosses configurable risk thresholds such as delinquency or compliance-health deterioration.	done	medium	medium	{a31637af-e809-4560-b8d4-964f900010ee}	\N	\N	\N	2026-03-14 14:52:01.840111	2026-03-14 14:52:01.894
5b3ec3ce-d60f-4bfb-88cc-1fa6b39de843	130614dc-fe17-427c-bc29-dd957cf3c797	ca946259-c6d9-4bb5-88af-05b2010be5a6	Add template versioning and historical preservation	Ensure evolving legal template content does not overwrite already-issued compliance records.	done	medium	medium	{0725a135-f15c-4b84-85c4-3e3f28249e48}	\N	\N	\N	2026-03-14 14:52:01.819108	2026-03-14 14:52:01.884
6d4a93f8-bb6e-4359-ae09-a45d226ba507	130614dc-fe17-427c-bc29-dd957cf3c797	ca946259-c6d9-4bb5-88af-05b2010be5a6	Support association-specific custom requirement overlays	Allow local requirements to extend state templates without forking the core template model.	done	medium	low	{5b3ec3ce-d60f-4bfb-88cc-1fa6b39de843}	\N	\N	\N	2026-03-14 14:52:01.823803	2026-03-14 14:52:01.887
a4628ae4-7302-4246-8a32-57c6a6df269f	130614dc-fe17-427c-bc29-dd957cf3c797	e0178afe-8b3f-444b-ae19-b1b89a772933	Add exportable portfolio performance reports	Generate portfolio-level exports for management leadership and investor-style review use cases.	done	small	low	{4d017780-7175-4e21-bf0a-0fe96aa12ab6}	\N	\N	\N	2026-03-14 14:52:01.843992	2026-03-14 14:52:01.897
0725a135-f15c-4b84-85c4-3e3f28249e48	130614dc-fe17-427c-bc29-dd957cf3c797	ca946259-c6d9-4bb5-88af-05b2010be5a6	Add association-level template assignment and composition	Assign one or more state templates to an association and compose them with its local operating context.	done	medium	medium	{5b34bfe3-d2af-4d9e-8cfb-3aed50ac33c8}	\N	\N	\N	2026-03-14 14:52:01.813245	2026-03-14 14:52:01.881
8b8d173a-276c-4bed-8a96-d52698a1ced8	130614dc-fe17-427c-bc29-dd957cf3c797	96384569-2d06-4277-b2a2-4125604fb955	Create configurable board report package builder	Allow operators to define package sections, ordering, and included source modules for recurring board packet generation.	done	large	high	{}	\N	\N	2026-03-14 14:58:07.958205	2026-03-14 14:52:01.725991	2026-03-14 14:58:07.958205
205f2928-7ab0-417c-a88d-455be1e16c62	38b68bc4-7837-448e-981f-bcd55aca5bef	62c67e19-22e7-439d-a266-d91369f549ca	Add intake request records for association and unit-bound signup	Model submissions, invite state, resident type, source channel, and links to the target association and unit.	done	large	critical	{}	\N	\N	\N	2026-03-14 14:45:38.468207	2026-03-14 14:58:22.132886
561d8a00-4848-4375-a6fd-e550302bd44b	38b68bc4-7837-448e-981f-bcd55aca5bef	62c67e19-22e7-439d-a266-d91369f549ca	Add secure token lifecycle for unit-linked invitations	Support token generation, expiration, single-use or renewable rules, and audit fields for issuance and redemption.	done	medium	critical	{}	\N	\N	\N	2026-03-14 14:45:38.468207	2026-03-14 14:58:22.132886
ae16f8e3-d873-4539-a286-0acea8ef6722	38b68bc4-7837-448e-981f-bcd55aca5bef	6b73926a-a6d0-40e4-842f-78d70d90cfc8	Generate and track unit-specific signup links	Create per-unit links for owner or tenant intake and expose issuance, resend, expiration, and completion state.	done	medium	high	{}	\N	\N	\N	2026-03-14 14:45:38.468207	2026-03-14 14:58:22.132886
c81b0518-7840-4e55-bfe5-82e5cff7d681	38b68bc4-7837-448e-981f-bcd55aca5bef	11eed2c2-31cb-4be3-bcb2-edf375854d1d	Build owner intake form for unit-linked signup	Collect owner identity and contact details, ownership specifics, and consent for platform setup using a bound association and unit token.	done	large	high	{}	\N	\N	\N	2026-03-14 14:45:38.468207	2026-03-14 14:58:22.132886
d0626d9e-74d0-4411-9877-4ab692e245b9	38b68bc4-7837-448e-981f-bcd55aca5bef	11eed2c2-31cb-4be3-bcb2-edf375854d1d	Build tenant intake form for unit-linked signup	Collect tenant identity, contact details, tenancy dates, and communication preferences using the bound unit link.	done	large	high	{}	\N	\N	\N	2026-03-14 14:45:38.468207	2026-03-14 14:58:22.132886
f5325eea-dd99-44d7-9ce2-b77c6d2dcaf5	38b68bc4-7837-448e-981f-bcd55aca5bef	11eed2c2-31cb-4be3-bcb2-edf375854d1d	Validate submissions against bound association and unit context	Prevent cross-association contamination, reject invalid or expired links, and preserve a clean review queue.	done	medium	critical	{}	\N	\N	\N	2026-03-14 14:45:38.468207	2026-03-14 14:58:22.132886
a03909f6-feb1-457a-b9b6-97067d205d42	38b68bc4-7837-448e-981f-bcd55aca5bef	1dbf100f-a63a-4953-a085-45fdc41f8470	Build review queue for submitted intake	Give admins a queue to compare submitted data to existing persons and current unit state before approval.	done	large	high	{}	\N	\N	\N	2026-03-14 14:45:38.468207	2026-03-14 14:58:22.132886
0190a259-abc1-4ec4-ae3d-878fb7b009e3	38b68bc4-7837-448e-981f-bcd55aca5bef	1dbf100f-a63a-4953-a085-45fdc41f8470	Approve submissions into person, ownership, occupancy, and portal records	Create or merge the right records and activate the correct owner or tenant portal relationship on approval.	done	large	critical	{}	\N	\N	\N	2026-03-14 14:45:38.468207	2026-03-14 14:58:22.132886
aca5e4dc-3daf-4536-ac87-30f72d4707a5	38b68bc4-7837-448e-981f-bcd55aca5bef	6b73926a-a6d0-40e4-842f-78d70d90cfc8	Build onboarding console for associations with no contacts	Surface contact coverage, unclaimed units, pending submissions, and next-step actions inside association onboarding.	done	large	high	{}	\N	\N	\N	2026-03-14 14:45:38.468207	2026-03-14 15:15:03.199819
270330c3-d1c2-4882-98d9-9a857840020e	130614dc-fe17-427c-bc29-dd957cf3c797	96384569-2d06-4277-b2a2-4125604fb955	Add board packet preview, annotation, and approval workflow	Allow board admins to review and edit a package before release so generated output is still controlled and defensible.	done	medium	medium	{e1a0395e-abd8-4314-b7ea-7faa5680e085}	\N	\N	2026-03-14 15:15:33.338698	2026-03-14 14:52:01.735748	2026-03-14 15:15:33.338698
93262cc2-f16a-4bec-a69d-930396199f4f	7e5b4164-9714-412b-91a2-14ff5c5b55d6	427d9f2d-e9e1-4966-9cee-20adb8cf269b	Validate hosted OAuth routing and Google callback configuration	Confirm /api/auth/google route reachability in hosted environment, align Google Console redirect URI, and verify full sign-in roundtrip from launcher to authenticated /api/auth/me.	done	small	critical	{}	\N	\N	2026-03-14 16:08:42.088925	2026-03-12 19:00:06.001306	2026-03-14 16:08:42.088925
00d7a662-9c00-402f-8bc1-4ad65ac8ae39	afd38fb0-c594-4b57-8151-397146ab973d	52e2ea28-5058-46f2-90fa-c403fc8f28ee	Add bulk CSV import for owner ledger entries	Ledger entries must be created one at a time. Add CSV import for bulk posting of payments received (e.g., from bank statement). Format: unit, date, amount, type, memo.\n\n**PM perspective:** End-of-month bank reconciliation requires importing 50-200 payments at once.	done	medium	medium	{}	\N	\N	\N	2026-03-17 01:44:01.659339	2026-03-17 01:44:01.659339
eb3900cb-5693-4e6d-908b-0d5e068301eb	afd38fb0-c594-4b57-8151-397146ab973d	52e2ea28-5058-46f2-90fa-c403fc8f28ee	Add payment plan support for delinquent accounts	There is no way to set up a payment arrangement for an owner who is delinquent. Add a payment plan workflow: propose plan → board approves → owner receives terms → payments tracked against plan → late fees suspended during active plan.\n\n**PM perspective:** Payment plans reduce collections costs and keep owners in good standing.	done	large	medium	{}	\N	\N	\N	2026-03-17 01:44:01.655728	2026-03-17 01:44:01.655728
07bea471-75b0-451c-bd78-c2e193050465	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	980709db-e507-44bc-82f2-ef136cb2378e	Derive canonical unit occupancy state and counts	Implement owner-occupied, rental, and vacant derivation logic plus owner/tenant count and last-occupancy-update semantics for FTPH 1.5.1.\n\nFTPH Functional Units: 1.5.1\n\nImplementation Update: Delivered on 2026-03-15: residential dataset and association overview responses now derive canonical unit occupancy state from active ownership and occupancy records, exposing owner-occupied, rental-occupied, vacant, and unassigned statuses plus owner count, tenant count, occupant count, last occupancy update, vacancy rollups, and occupancy-rate summary metrics for association operations views.	done	medium	high	{5c3c36f6-e7a3-401c-baf4-daaa932b3926}	2026-04-13 00:00:00	2026-04-26 00:00:00	2026-03-15 13:57:55.728	2026-03-15 12:39:13.202705	2026-03-15 14:02:11.145
fb5f2f31-0397-4075-b9c2-64786466b2c2	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	7ffd2607-e63b-4ac3-aace-dd391efc070f	Replace generic payment method instructions with structured owner payment setup	Store structured payment instruction fields and generate owner-specific payment setup notices for FTPH 3.3.1 through 3.3.3.\n\nFTPH Functional Units: 3.3.1, 3.3.2, 3.3.3\n\nImplementation Update: Delivered on 2026-03-15: payment methods now store structured owner setup fields including account name, bank name, routing number, account number, mailing address, payment notes, Zelle handle, and support contacts. Owner payment instruction sends now render those structured values into canonical financial notice variables and stay on the owner-targeted routing path.	done	medium	medium	{b85b049c-a150-4fa2-9f70-87ef3e68ad03,e5226e7d-77ab-4caf-9b68-bf410d601c06}	2026-04-27 00:00:00	2026-05-10 00:00:00	2026-03-15 14:24:43.452	2026-03-15 12:39:13.233838	2026-03-15 14:29:08.234
ba1af70f-738b-4fb8-ac49-e83080fcebc6	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	980709db-e507-44bc-82f2-ef136cb2378e	Expand association completeness metrics and remediation actions	Compute owner, tenant, board, payment, communications, and occupancy completion rates and surface direct remediation actions for FTPH 1.5.2 through 1.5.4.\n\nFTPH Functional Units: 1.5.2, 1.5.3, 1.5.4\n\nImplementation Update: Delivered on 2026-03-15: onboarding completeness now computes explicit setup domains for units, owner data, tenant data, board setup, payment methods, and communication templates. The association onboarding console renders those domain-level completion metrics and direct remediation cards that route administrators to owner-link collection, tenant-data collection, board setup, payments, and communications configuration.	done	medium	medium	{07bea471-75b0-451c-bd78-c2e193050465}	2026-04-27 00:00:00	2026-05-10 00:00:00	2026-03-15 14:02:11.149	2026-03-15 12:39:13.20613	2026-03-15 14:02:11.149
c7042002-5429-42a9-9920-b7d1e324d96a	afd38fb0-c594-4b57-8151-397146ab973d	bffc2f86-4632-46fa-81f0-95d6307b8d86	Add quorum tracking and attendance roster to meetings	Votes are recorded but there's no attendance tracking. A meeting with < quorum can't legally proceed. Add an attendance roster per meeting that (1) validates quorum before allowing vote recording, and (2) persists attendance for minutes generation.\n\n**Self-managed:** A common board mistake is holding a vote without verifying quorum — this creates legal exposure.	done	medium	high	{}	\N	\N	\N	2026-03-17 01:44:01.668169	2026-03-17 02:12:15.355482
8361874c-53ce-4f31-8dfa-96df28d3215f	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	b817054c-91ef-46d5-a9ca-ab1a92f0436b	Add resident feedback and satisfaction analytics	Launch feedback capture, satisfaction aggregation, and improvement-theme clustering for FTPH 9.6.1 through 9.6.3.\n\nFTPH Functional Units: 9.6.1, 9.6.2, 9.6.3	done	medium	medium	{ba1af70f-738b-4fb8-ac49-e83080fcebc6}	2026-05-25 00:00:00	2026-06-07 00:00:00	\N	2026-03-15 12:39:13.302906	2026-03-15 12:45:34.623
1d249214-7cdd-436f-9c45-07862f2ec93c	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	b817054c-91ef-46d5-a9ca-ab1a92f0436b	Implement community announcements and bulletin board	Add board announcement publishing, owner feed, categories, and push-notice integration for FTPH 9.5.1 through 9.5.4.\n\nFTPH Functional Units: 9.5.1, 9.5.2, 9.5.3, 9.5.4	done	medium	low	{e5226e7d-77ab-4caf-9b68-bf410d601c06,fd2c8f2a-e9a3-4021-96b6-61ecd5fdefd9}	2026-05-25 00:00:00	2026-06-07 00:00:00	\N	2026-03-15 12:39:13.306237	2026-03-15 12:45:34.626
95483eb5-f763-4f0a-8033-a9ef4e10ac6c	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	b817054c-91ef-46d5-a9ca-ab1a92f0436b	Deliver owner financial dashboard and payment self-service	Implement balance summary, payment history, statements, and payment initiation for FTPH 9.1.1 through 9.1.4.\n\nFTPH Functional Units: 9.1.1, 9.1.2, 9.1.3, 9.1.4	done	large	medium	{fb5f2f31-0397-4075-b9c2-64786466b2c2}	2026-05-25 00:00:00	2026-06-07 00:00:00	\N	2026-03-15 12:39:13.29915	2026-03-15 12:45:34.62
5efc7dbd-cd38-4249-a682-6e4e6bcd737c	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	470ec898-7f5f-4413-b348-6fe7644d7d91	Implement governance reminder cadence and recipient routing	Support configurable reminder rules plus 30-day, 14-day, and 7-day cadence delivery to board members and administrators for FTPH 6.2.1 through 6.2.3.\n\nFTPH Functional Units: 6.2.1, 6.2.2, 6.2.3	done	medium	medium	{b85b049c-a150-4fa2-9f70-87ef3e68ad03,ba1af70f-738b-4fb8-ac49-e83080fcebc6}	2026-05-11 00:00:00	2026-05-24 00:00:00	\N	2026-03-15 12:39:13.285932	2026-03-15 12:45:34.61
468240c8-ac6f-40b9-a05b-de9b0d4dab55	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	c56068ba-3577-4f03-a649-1d9e042ca481	Expand AI ingestion raw-source support beyond text-centric uploads	Add first-class handling for common binary admin artifacts such as PDF-derived source ingestion so FTPH 4.2.1 is no longer constrained to text-like uploads.\n\nFTPH Functional Units: 4.2.1\n\nImplementation Update: Delivered on 2026-03-15: ingestion now accepts PDFs, DOCX files, and XLSX workbooks as first-class raw sources using server-side extraction, and the operator workflow/documentation were updated accordingly. Remaining broader backlog scope is binary coverage beyond those formats.	done	large	high	{ce417a2d-41f5-4d2d-8adc-22453e811135}	2026-03-30 00:00:00	2026-04-12 00:00:00	2026-03-15 13:14:33.193	2026-03-15 12:39:13.241085	2026-03-15 13:34:09.275
611d7a48-45dd-4fd4-ada5-77eba2266a20	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	285e8632-8b6c-4257-9ee5-db15c0ece2f5	Create managed regulatory source registry with freshness metadata	Track source URL, source authority, jurisdiction, effective date, last verified date, last updated date, and publication state for FTPH 8.4.1.\n\nFTPH Functional Units: 8.4.1\n\nImplementation Update: Delivered on 2026-03-15: governance compliance records now persist source authority, source URL, source document title, source document date, effective date, last source update date, verification timestamps, next review date, publication status, published date, and review notes. Checklist items also store legal-reference and source-citation fields so jurisdiction records remain traceable to authoritative sources.	done	large	high	{}	2026-03-16 00:00:00	2026-03-29 00:00:00	2026-03-15 14:41:11.264	2026-03-15 12:39:13.268216	2026-03-15 14:51:52.981
fd2c8f2a-e9a3-4021-96b6-61ecd5fdefd9	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	470ec898-7f5f-4413-b348-6fe7644d7d91	Deliver board package automation and notice distribution	Build package generation, preview/edit, scheduled creation, and distribution workflows for FTPH 8.1.1 through 8.1.4.\n\nFTPH Functional Units: 8.1.1, 8.1.2, 8.1.3, 8.1.4	done	medium	medium	{5efc7dbd-cd38-4249-a682-6e4e6bcd737c,e5226e7d-77ab-4caf-9b68-bf410d601c06}	2026-05-11 00:00:00	2026-05-24 00:00:00	\N	2026-03-15 12:39:13.289358	2026-03-15 12:45:34.613
5aa70263-07ad-4691-95ec-864f4287a284	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	470ec898-7f5f-4413-b348-6fe7644d7d91	Implement regulatory filing review and export workflows	Use the managed regulatory record base to deliver filing template library, pre-population, review, export, and due-date tracking for FTPH 10.6.1 through 10.6.5.\n\nFTPH Functional Units: 10.6.1, 10.6.2, 10.6.3, 10.6.4, 10.6.5	done	large	medium	{21c17182-b528-4d9a-ae9a-d70adacba21a,1c0020a5-6fd3-4369-a789-e38753b5b576}	2026-05-11 00:00:00	2026-05-24 00:00:00	\N	2026-03-15 12:39:13.292828	2026-03-15 12:45:34.617
e2af3baf-6f95-4317-9d3b-516f27ce22f0	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	761bb733-b745-4ae1-b05c-0f0f9af72f0a	Define public API and webhook delivery plan	Break out REST resources, API key management, webhook framework, and developer portal requirements for FTPH 10.3.1 through 10.3.5.\n\nFTPH Functional Units: 10.3.1, 10.3.2, 10.3.3, 10.3.4, 10.3.5	todo	medium	low	{3aa3cf6a-0fd6-47f5-9407-169cb0002266}	2026-06-08 00:00:00	2026-06-21 00:00:00	\N	2026-03-15 12:39:13.320588	2026-03-15 12:45:34.636
46d17e83-90f6-4925-9938-edcb47e0157d	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	761bb733-b745-4ae1-b05c-0f0f9af72f0a	Plan reseller architecture and subscription billing closure	Translate FTPH 10.4 and 10.5 into implementable platform-control, billing, and white-label delivery tasks.\n\nFTPH Functional Units: 10.4.1, 10.4.2, 10.4.3, 10.4.4, 10.4.5, 10.5.1, 10.5.2, 10.5.3, 10.5.4, 10.5.5	todo	medium	low	{e2af3baf-6f95-4317-9d3b-516f27ce22f0}	2026-06-08 00:00:00	2026-06-21 00:00:00	\N	2026-03-15 12:39:13.324409	2026-03-15 12:45:34.64
1c0020a5-6fd3-4369-a789-e38753b5b576	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	285e8632-8b6c-4257-9ee5-db15c0ece2f5	Activate AI compliance gap detection on approved regulatory and bylaw records	Deliver compliance rule extraction, gap detection, alert dashboards, and suppression workflows for FTPH 8.3.1 through 8.3.4.\n\nFTPH Functional Units: 8.3.1, 8.3.2, 8.3.3, 8.3.4\n\nImplementation Update: Delivered on 2026-03-15: clause-based compliance rule extraction now feeds a managed-record comparison engine that computes association-specific compliance gaps against published regulatory records, surfaces them in the governance compliance dashboard, and supports suppression or resolution overrides for reviewed alerts.	done	large	medium	{9d7dc7fa-e7c7-4ed1-b56b-15e09338169e,21c17182-b528-4d9a-ae9a-d70adacba21a,1ee767ef-0b4f-4627-8e5b-b17775539055}	2026-04-27 00:00:00	2026-05-10 00:00:00	2026-03-15 14:51:53	2026-03-15 12:39:13.279089	2026-03-15 14:51:53
a444870e-fd4f-4191-8883-a11931c54e58	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	b817054c-91ef-46d5-a9ca-ab1a92f0436b	Stage amenity booking, digital signature, and voting backlog for portal expansion	Define implementation-ready delivery slices for FTPH 9.2, 9.3, and 9.4 so owner-experience expansion can proceed without reopening discovery.\n\nFTPH Functional Units: 9.2.1, 9.2.2, 9.2.3, 9.2.4, 9.2.5, 9.3.1, 9.3.2, 9.3.3, 9.3.4, 9.3.5, 9.4.1, 9.4.2, 9.4.3, 9.4.4	todo	medium	low	{95483eb5-f763-4f0a-8033-a9ef4e10ac6c}	2026-05-25 00:00:00	2026-06-07 00:00:00	\N	2026-03-15 12:39:13.309858	2026-03-15 12:45:34.63
3aa3cf6a-0fd6-47f5-9407-169cb0002266	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	761bb733-b745-4ae1-b05c-0f0f9af72f0a	Prioritize external integrations across banking, accounting, and identity	Define delivery order and contract boundaries for FTPH 10.1 and non-Google 10.2 branches so the integration backlog is implementation-ready.\n\nFTPH Functional Units: 10.1.1, 10.1.2, 10.1.3, 10.1.4, 10.1.5, 10.2.2, 10.2.3, 10.2.4, 10.2.5	todo	medium	low	{5aa70263-07ad-4691-95ec-864f4287a284,95483eb5-f763-4f0a-8033-a9ef4e10ac6c}	2026-06-08 00:00:00	2026-06-21 00:00:00	\N	2026-03-15 12:39:13.316729	2026-03-15 12:45:34.633
faf84c6e-3505-4a58-a4de-cad0bb43c86a	b6c2d9d5-3780-496f-b957-0a6b2da15da6	0c78fc58-df34-48e9-9a0a-a95ee50bba03	ISS-033 Repair vote submission and tally acceptance logic	Investigate why vote input is rejected and restore reliable vote capture for governance decisions.	done	medium	high	{3c20e5b6-de10-4457-a423-d2b3670f581d}	2026-03-16 00:00:00	2026-03-27 00:00:00	2026-03-16 15:20:52.373561	2026-03-16 14:20:26.505863	2026-03-16 15:20:52.373561
2d3927a2-9464-46c8-a77f-ce2ff3e89beb	d5c23cf5-75c5-4823-9e93-afd849dd150a	f016071d-3fd8-422d-aceb-89411966d826	Add board-member access role and lifecycle fields	Extend portal or access-control data model with a first-class board-member role plus invite, acceptance, suspension, and revocation lifecycle timestamps.	done	large	critical	{}	\N	\N	2026-03-15 12:53:02.516	2026-03-15 12:40:52.875536	2026-03-15 12:53:02.516
86add5f5-25ea-443f-8a09-a0ee995f07bd	d5c23cf5-75c5-4823-9e93-afd849dd150a	f016071d-3fd8-422d-aceb-89411966d826	Link board-member access grants to board service and association scope	Persist the relationship between invited access, active board-role assignment, person identity, and a single association boundary so elevated access is not global.	done	medium	critical	{}	\N	\N	2026-03-15 12:53:02.52	2026-03-15 12:40:52.883893	2026-03-15 12:53:02.52
bb6b0515-d3fa-41bf-afc1-afc0427c7742	d5c23cf5-75c5-4823-9e93-afd849dd150a	ef7c8ba4-2783-474a-a18f-a89d4cd45c41	Build admin board-member invite flow	Allow admins to invite a person from governance or board workflows into a board-member association workspace using their existing person record where possible.	done	medium	high	{}	\N	\N	2026-03-15 12:53:02.524	2026-03-15 12:40:52.895112	2026-03-15 12:53:02.524
c269a6f4-00a0-458f-a690-f5d16e0eda90	d5c23cf5-75c5-4823-9e93-afd849dd150a	ef7c8ba4-2783-474a-a18f-a89d4cd45c41	Implement invite acceptance and activation rules	Activate board-member access only after invite acceptance and confirmation that the linked board role is active for the same association.	done	medium	critical	{}	\N	\N	2026-03-15 12:53:02.527	2026-03-15 12:40:52.900045	2026-03-15 12:53:02.527
9afcce89-0af9-4d02-a8dd-6186c8e26e56	d5c23cf5-75c5-4823-9e93-afd849dd150a	636e6808-dfe7-43cb-9db0-f3c619427cfa	Preserve owner self-service access when board service ends	If the same person retains valid owner access after board service ends or access is revoked, remove elevated board permissions without breaking owner self-service flows.	done	medium	high	{}	\N	\N	2026-03-15 12:57:43.28	2026-03-15 12:40:52.923569	2026-03-15 12:57:43.28
7a8e972f-4b98-4513-be94-89a49cd4f84b	d5c23cf5-75c5-4823-9e93-afd849dd150a	636e6808-dfe7-43cb-9db0-f3c619427cfa	Resolve combined owner and board-member permissions under one identity	When a person is both an owner and an active invited board member in the same association, combine owner self-service and board-member workspace permissions under one signed-in identity.	done	large	critical	{}	\N	\N	2026-03-15 12:53:02.534	2026-03-15 12:40:52.913498	2026-03-15 12:53:02.534
1e42e946-5aa4-41a3-b53f-5c4b686c397c	d5c23cf5-75c5-4823-9e93-afd849dd150a	e50d2d83-99d3-4097-aa39-6339b666bc8a	Run end-to-end verification for board-member scope boundaries	Verify invited board members can view and edit in-scope association records, cannot access other associations, and do not see platform-admin-only controls.	done	medium	high	{}	\N	\N	2026-03-15 13:03:05.276	2026-03-15 12:40:52.95347	2026-03-15 13:03:05.276
642f39d7-3cb9-4a43-9240-2f7d59c3417f	d5c23cf5-75c5-4823-9e93-afd849dd150a	e50d2d83-99d3-4097-aa39-6339b666bc8a	Audit log board-member invite lifecycle and write actions	Record invite, activation, suspension, revocation, and board-member write events with actor identity, association scope, and timestamp.	done	medium	high	{}	\N	\N	2026-03-15 12:57:43.284	2026-03-15 12:40:52.948433	2026-03-15 12:57:43.284
748cd9b3-2b01-40dc-83b5-d5e289fda79a	d5c23cf5-75c5-4823-9e93-afd849dd150a	7a09c7b2-1533-4ea0-953c-de3bcc8c31f8	Build board-member landing view and navigation	Show the active association, board-member context, and all allowed association-scoped modules while hiding platform-global administration surfaces.	done	medium	high	{}	\N	\N	2026-03-15 12:53:02.543	2026-03-15 12:40:52.934259	2026-03-15 12:53:02.543
fe84ec21-4cf7-4524-af02-31369d6f6526	d5c23cf5-75c5-4823-9e93-afd849dd150a	7a09c7b2-1533-4ea0-953c-de3bcc8c31f8	Support seamless switching between owner and board capabilities	For owner-board members, let the workspace expose both self-service and board operations coherently without separate disconnected logins.	done	medium	high	{}	\N	\N	2026-03-15 12:53:02.546	2026-03-15 12:40:52.938325	2026-03-15 12:53:02.546
82560360-50e0-41cd-96ab-3cc98226c76a	d5c23cf5-75c5-4823-9e93-afd849dd150a	636e6808-dfe7-43cb-9db0-f3c619427cfa	Enforce association-scoped board permissions across API reads and writes	Apply authorization checks that allow board-member access only within the invited association and reject attempts to access platform-global or other-association records.	done	large	critical	{}	\N	\N	2026-03-15 13:03:05.27	2026-03-15 12:40:52.919495	2026-03-15 13:03:05.27
eefabce4-594b-4d9a-b5b9-e1d38462ef8d	d5c23cf5-75c5-4823-9e93-afd849dd150a	ef7c8ba4-2783-474a-a18f-a89d4cd45c41	Handle reinvite, expiry, suspension, and revocation states	Prevent duplicate conflicting active records and ensure board-member access can be expired, suspended, revoked, and later reissued cleanly.	done	medium	high	{}	\N	\N	2026-03-15 12:57:43.253	2026-03-15 12:40:52.904822	2026-03-15 12:57:43.253
b152a8c0-6c62-4595-9bf4-1254b0c475e1	ff940b75-154f-4b87-810a-70ebf9436de2	2c588d17-3c00-4219-bf86-51c99e7978fa	Document board self-service workspace operating model	Record that board members are lightweight operators with direct write authority for in-scope association workflows, especially for self-managed or highly involved boards.\n\nImplementation Update: Captured in the board workspace review and implementation plan as the core service model: lightweight operators with direct write authority for in-scope association workflows.	done	small	critical	{}	\N	\N	2026-03-15 13:18:19.371	2026-03-15 13:13:49.590798	2026-03-15 13:20:29.886
9aea8bd0-34ce-4191-ba30-58e58934a87d	afd38fb0-c594-4b57-8151-397146ab973d	bffc2f86-4632-46fa-81f0-95d6307b8d86	Add resolution numbering and searchable resolution index	Resolutions are created without numbering. There is no way to search or filter resolutions across meetings. Add auto-numbering (e.g., RES-2025-001), categorization (financial, rule change, approval), and a searchable resolution index page.\n\n**PM perspective:** Clients ask 'did we pass a resolution on short-term rentals?' — currently requires manually scanning each meeting.	done	medium	medium	{}	\N	\N	\N	2026-03-17 01:44:01.673564	2026-03-17 02:27:29.924211
eda3e188-3b77-498e-b3e4-fedd647d3b3a	f4d97ef5-810b-41d2-a380-a356781cb8a8	f1a21171-8741-41b1-9130-5ad9cfc28c7d	Create machine-readable workspace bootstrap manifest	Generate a durable workspace manifest that captures stable route groups, key server and storage entry points, schema anchors, and standard verification commands so agents do not have to rediscover the repo shape on every session.	done	medium	critical	{}	\N	\N	2026-03-15 13:31:52.467	2026-03-15 13:26:42.135621	2026-03-15 13:31:52.467
49d2c374-238a-4065-9d40-7a7d56ff2bfe	ff940b75-154f-4b87-810a-70ebf9436de2	05383611-35c7-460a-b1d4-ec95069572b2	Capture current-state board workspace journey review	Describe the current board-member entry, activation, first-use, recurring-use, and failure/confusion points as a user journey rather than a code inventory.\n\nImplementation Update: Current-state journey findings were captured from the board member perspective, including activation, landing experience, task visibility, and operating gaps.	done	medium	high	{}	\N	\N	2026-03-15 13:18:19.439	2026-03-15 13:13:49.643465	2026-03-15 13:20:29.91
d733f399-05e0-48bb-8f7f-9efb09d8d43d	ff940b75-154f-4b87-810a-70ebf9436de2	05383611-35c7-460a-b1d4-ec95069572b2	Translate journey findings into service opportunities	Convert findings into explicit service opportunities across action-first workflow, activity visibility, state clarity, board operating loops, and trust communication.\n\nImplementation Update: Findings were translated into opportunities around action-first workflow, activity visibility, explicit states, and board operating loops.	done	medium	high	{}	\N	\N	2026-03-15 13:18:19.443	2026-03-15 13:13:49.647933	2026-03-15 13:20:29.915
0ff47a2b-ee50-4e02-b5b2-562a5b96bb45	ff940b75-154f-4b87-810a-70ebf9436de2	e4830d00-14df-4e24-a602-e64c787b56d4	Record direct-write board authority and association scope rules	Make direct-write authority, one-identity owner-plus-board access, and association-only boundaries explicit in the roadmap project plan.\n\nImplementation Update: Direct-write board authority and association-scoped access boundaries are now explicit product decisions for this workspace.	done	small	critical	{}	\N	\N	2026-03-15 13:18:19.447	2026-03-15 13:13:49.657883	2026-03-15 13:20:29.919
5c431b65-ebd3-455f-a3c5-89f064456b21	ff940b75-154f-4b87-810a-70ebf9436de2	e4830d00-14df-4e24-a602-e64c787b56d4	Define activity and state as essential product requirements	Promote activity records and state transitions from implementation detail to first-class requirements for the board workspace service model.\n\nImplementation Update: Activity history and workflow state were promoted to first-class product requirements for the board self-service model.	done	small	critical	{}	\N	\N	2026-03-15 13:18:19.451	2026-03-15 13:13:49.664443	2026-03-15 13:20:29.924
4784a896-2bec-4880-a35a-b08b57f32e0f	ff940b75-154f-4b87-810a-70ebf9436de2	5fa31333-cacd-4404-a01f-49d8752ad544	Plan governance task and meeting management chunk	Define the next implementation slice that allows board members to manage governance tasks and meeting workflows directly in the workspace.\n\nImplementation Update: Delivered: board members can now create and update governance meetings and annual governance tasks directly from the portal workspace.	done	medium	high	{}	\N	\N	2026-03-15 13:43:13.829	2026-03-15 13:13:49.703288	2026-03-15 13:43:13.829
22a721ce-c1d1-4796-bea2-e75a5e99650e	ff940b75-154f-4b87-810a-70ebf9436de2	66d30d30-90d2-477d-b039-832ce8313e99	Define plan-first then implement-next roadmap workflow	Write down the recurring working practice: clarify service intent, review journey, create plan/project, implement in chunks, verify, then close.\n\nImplementation Update: The planning backbone now codifies the working rhythm: clarify service intent, review the journey, capture findings, structure the project, implement in chunks, verify, and only then close.	done	small	critical	{}	\N	\N	2026-03-15 13:18:19.482	2026-03-15 13:13:49.742688	2026-03-15 13:20:29.936
f47a6636-52a2-4348-839f-c69e39308480	ff940b75-154f-4b87-810a-70ebf9436de2	5fa31333-cacd-4404-a01f-49d8752ad544	Plan communications and document-publishing chunk	Define the implementation slice that lets board members draft, review, send, and publish in-scope board communications and documents.\n\nImplementation Update: Delivered: board members can now upload/publish documents, control portal visibility, compose direct notices, and review send/history records from the portal workspace.	done	medium	high	{}	\N	\N	2026-03-15 13:43:13.833	2026-03-15 13:13:49.711123	2026-03-15 13:43:13.833
8d21027e-bfe8-4578-8c14-ae8012126108	ff940b75-154f-4b87-810a-70ebf9436de2	5fa31333-cacd-4404-a01f-49d8752ad544	Plan maintenance and financial action surfaces	Define the board-facing write and review actions needed for maintenance triage and financial operating loops without promoting board members into platform admins.\n\nImplementation Update: Delivered: board members can now triage maintenance requests, manage vendor invoices, post owner-ledger entries, and review owner balance exposure directly from the portal workspace.	done	medium	medium	{}	\N	\N	2026-03-15 13:43:13.837	2026-03-15 13:13:49.72833	2026-03-15 13:43:13.837
9bf7422d-fb64-44e6-8c08-9c77e4dda14b	ff940b75-154f-4b87-810a-70ebf9436de2	2c588d17-3c00-4219-bf86-51c99e7978fa	Publish admin roadmap service-journey backbone standard	Create the reusable planning standard that requires service intent, journey review, findings, decisions, opportunities, implementation chunks, and verification before implementation begins.\n\nImplementation Update: Documented in the reusable Admin roadmap service-journey backbone so future projects follow plan first, implement next.	done	small	high	{}	\N	\N	2026-03-15 13:18:19.425	2026-03-15 13:13:49.595593	2026-03-15 13:20:29.892
47ace4a3-d64d-4dfc-97cf-90b9399b2657	f4d97ef5-810b-41d2-a380-a356781cb8a8	46a2dfed-2b0c-4c96-81af-1c90b0dc0c59	Define success metrics for reduced startup and rediscovery cost	Measure bootstrap effectiveness with metrics such as setup time avoided, repeated searches reduced, roadmap improvements generated, and verification paths reused so the backbone can improve based on evidence.	done	small	medium	{}	\N	\N	2026-03-15 14:30:28.684	2026-03-15 13:26:42.226768	2026-03-15 14:30:28.684
8a66f100-b950-4192-82a1-2e8d1186668b	ff940b75-154f-4b87-810a-70ebf9436de2	41c3629a-109b-464f-b880-a723399301fd	Plan board-visible activity feed and change summaries	Define the feed, event model, and UI summaries that let board members understand what changed, who changed it, and when.\n\nImplementation Update: Delivered: the board dashboard now includes recent association activity sourced from audit history so board operators can see what changed and when.	done	medium	high	{}	\N	\N	2026-03-15 13:43:13.819	2026-03-15 13:13:49.684383	2026-03-15 13:43:13.819
f4a5c8cd-8bc1-487b-8012-a63b9bc8eb08	ff940b75-154f-4b87-810a-70ebf9436de2	66d30d30-90d2-477d-b039-832ce8313e99	Add verification and closeout expectations to the project plan	Ensure every future service-oriented roadmap project includes explicit verification tasks and honest status updates before closure.\n\nImplementation Update: Verification and honest status maintenance are part of the backbone documentation and are being applied as the project advances.	done	small	high	{}	\N	\N	2026-03-15 13:18:19.486	2026-03-15 13:13:49.747766	2026-03-15 13:20:29.941
cba1ffae-5dff-43e8-8187-36e7e6c27bc9	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	c56068ba-3577-4f03-a649-1d9e042ca481	Add commit importers for meeting notes and document metadata outputs	Implement downstream persistence flows for currently extraction-only record types so FTPH 4.2.3 covers all published ingestion outputs.\n\nFTPH Functional Units: 4.2.3\n\nImplementation Update: Delivered on 2026-03-15: approved meeting-notes records now import into governance meetings/meeting notes, and approved document-metadata records now reconcile into the document repository by updating a linked source document or creating a repository document from the ingestion source file.	done	large	high	{468240c8-ac6f-40b9-a05b-de9b0d4dab55,ce417a2d-41f5-4d2d-8adc-22453e811135}	2026-04-13 00:00:00	2026-04-26 00:00:00	2026-03-15 13:14:33.199	2026-03-15 12:39:13.24506	2026-03-15 13:34:09.29
53106efa-ad2f-4600-9ba9-f8e59fce65bc	ff940b75-154f-4b87-810a-70ebf9436de2	41c3629a-109b-464f-b880-a723399301fd	Plan action-first landing and attention queue	Break down the work needed to make the board home screen lead with what requires action now instead of passive summaries alone.\n\nImplementation Update: Delivered: the board dashboard now leads with a Needs Attention queue driven by maintenance, governance, meetings, balances, and document visibility signals.	done	medium	high	{}	\N	\N	2026-03-15 13:43:13.793	2026-03-15 13:13:49.678744	2026-03-15 13:43:13.793
ce417a2d-41f5-4d2d-8adc-22453e811135	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	c56068ba-3577-4f03-a649-1d9e042ca481	Harden ingestion reprocess and import-run history integrity	Preserve historical import-run references when jobs are reprocessed and prevent extracted-record replacement from breaking review or rollback history.\n\nFTPH Functional Units: 4.2.3\n\nImplementation Update: Delivered on 2026-03-15: reprocessing now supersedes prior extracted records and clause records instead of deleting them, preserving historical import-run foreign-key integrity while keeping active review queues scoped to unsuperseded outputs. The admin ingestion workspace surfaces active versus superseded outputs per job, can include superseded records/clauses in review, reports superseded-output accumulation in rollout monitoring, and provides retention-based cleanup preview/execution for purgeable superseded clauses and unreferenced extracted records.	done	medium	critical	{}	2026-03-16 00:00:00	2026-03-29 00:00:00	2026-03-15 13:14:33.205	2026-03-15 12:39:13.260682	2026-03-15 13:34:09.3
0b0aeb73-f7bb-4149-8240-2ea12c96cdc5	afd38fb0-c594-4b57-8151-397146ab973d	bffc2f86-4632-46fa-81f0-95d6307b8d86	Add board term expiration tracking and vacancy alerts	Board roles have end dates but there's no alert when a term is approaching expiration or when a position becomes vacant. Add a 'board roster health' indicator showing vacant seats and roles expiring within 90 days.\n\n**Self-managed:** Boards routinely miss election requirements because terms expire unnoticed.	done	small	medium	{}	\N	\N	\N	2026-03-17 01:44:01.681803	2026-03-17 02:29:22.204673
c064108b-7081-473c-afb9-a4cc2a5eeb7f	afd38fb0-c594-4b57-8151-397146ab973d	d45579a6-88c8-43eb-9bc0-515afa09a851	Add vendor assignment notifications for work orders	When a work order is assigned to a vendor, the vendor receives no notification. Add email notification to vendor contact with: work order details, location, priority, and a link to acknowledge/respond. Track acknowledgment status in the work order.\n\n**PM perspective:** Vendors currently call to ask if assignments are real — no closed-loop confirmation.	done	medium	high	{}	\N	\N	\N	2026-03-17 01:44:01.83062	2026-03-17 01:44:01.83062
b6fb964c-a7f3-4158-9612-68c5d78fe529	afd38fb0-c594-4b57-8151-397146ab973d	bffc2f86-4632-46fa-81f0-95d6307b8d86	Add compliance document upload for completed governance tasks	Compliance tasks can be marked complete but there's no way to attach proof (meeting minutes, filed documents, signed forms). Add a document attachment field to each governance task so the audit trail has evidence.\n\n**PM perspective:** When associations face audits or legal challenges, documented compliance is the defense.	done	small	medium	{}	\N	\N	\N	2026-03-17 01:44:01.823171	2026-03-17 01:44:01.823171
8fa4535a-c4e0-4f50-8d79-3165142800e1	afd38fb0-c594-4b57-8151-397146ab973d	d45579a6-88c8-43eb-9bc0-515afa09a851	Add SLA enforcement and escalation for work orders	Work orders have priority levels but no response/completion time targets. Add configurable SLAs: urgent = 4hr response / 24hr completion, high = 24hr/72hr, etc. Alert property manager when SLA is breached.\n\n**PM perspective:** SLA tracking is a client KPI — currently there's no way to show response time metrics.	done	medium	medium	{}	\N	\N	\N	2026-03-17 01:44:01.837402	2026-03-17 01:44:01.837402
17939781-afd8-4bee-bdd2-30a73df0ffda	afd38fb0-c594-4b57-8151-397146ab973d	bffc2f86-4632-46fa-81f0-95d6307b8d86	Fix board package distribution — add recipient management and delivery tracking	Board packages can be 'distributed' but the recipient list is ad-hoc email entry each time. Add: (1) default board recipient list per association, (2) delivery tracking (sent/opened/bounced), (3) re-send capability, (4) portal attachment so board members can access packages in the portal.\n\n**PM perspective:** No proof of delivery is a liability issue — 'I never received the package' is a common board complaint.	done	medium	high	{}	\N	\N	\N	2026-03-17 01:44:01.679003	2026-03-17 01:44:01.679003
71c84f43-a057-4f23-80ca-45dbe8c96087	9287c136-759b-432b-b82d-2ffa8d7ef695	425ab00f-24f7-4a79-b10f-d6b241eba756	Add shell-level breadcrumbs, page summaries, and adjacent workflow shortcuts	The shell currently uses a compact header with auth and context controls, but there is no breadcrumb or route explanation layer to orient users across the broad route map and admin in-page tabs. Add a reusable page chrome pattern with breadcrumb trail, current scope, page summary, and suggested next actions for related modules.\n\nImplementation Update: First execution slice delivered: added a reusable workspace page header with breadcrumbs, summaries, and adjacent shortcuts, then applied it to dashboard, association context, documents, owner ledger, and communications.	done	medium	high	{}	\N	\N	2026-03-15 14:51:18.937	2026-03-15 13:23:08.251167	2026-03-15 14:51:18.937
580fa32b-c9bd-49a6-b5d2-043a4572e53e	b6c2d9d5-3780-496f-b957-0a6b2da15da6	0c78fc58-df34-48e9-9a0a-a95ee50bba03	ISS-030 Consolidate and clean up meeting type selection	Replace confusing or duplicated meeting-type controls with one clear meeting-type selection workflow.	done	small	medium	{3c20e5b6-de10-4457-a423-d2b3670f581d}	2026-03-30 00:00:00	2026-04-10 00:00:00	2026-03-16 14:40:50.149	2026-03-16 14:20:26.476389	2026-03-16 14:20:26.476389
13b1f880-23d4-4048-911f-c0ad4b9d7553	b6c2d9d5-3780-496f-b957-0a6b2da15da6	0c78fc58-df34-48e9-9a0a-a95ee50bba03	ISS-032 Add labels and rules for agenda item numeric parameters	Clarify the unexplained numeric agenda field with explicit labels, examples, and validation behavior.	done	small	medium	{3c20e5b6-de10-4457-a423-d2b3670f581d}	2026-03-30 00:00:00	2026-04-10 00:00:00	2026-03-16 14:40:50.189	2026-03-16 14:20:26.501398	2026-03-16 14:20:26.501398
58e2339e-1e82-464d-8aee-c869cf72ac11	b6c2d9d5-3780-496f-b957-0a6b2da15da6	0c78fc58-df34-48e9-9a0a-a95ee50bba03	ISS-034 Remove anonymous voting from governance workflows	Enforce non-anonymous voting rules in governance contexts where board accountability is required.	done	small	medium	{faf84c6e-3505-4a58-a4de-cad0bb43c86a}	2026-03-30 00:00:00	2026-04-10 00:00:00	2026-03-16 14:40:50.194	2026-03-16 14:20:26.512198	2026-03-16 14:20:26.512198
1bf474ee-611e-444f-ac3f-9b31bb2618cf	f4d97ef5-810b-41d2-a380-a356781cb8a8	46a2dfed-2b0c-4c96-81af-1c90b0dc0c59	Adopt agent bootstrap backbone in admin roadmap planning standard	Extend the admin roadmap backbone so future service-oriented planning explicitly includes reusable bootstrap context, friction logging, and durable memory as first-class planning outputs.	done	small	high	{}	\N	\N	2026-03-15 13:29:52.72	2026-03-15 13:26:42.222372	2026-03-15 13:29:52.72
8602b7fa-eff7-48a0-800b-0e812d6edbf9	f4d97ef5-810b-41d2-a380-a356781cb8a8	f1a21171-8741-41b1-9130-5ad9cfc28c7d	Add refresh rules for manifest drift detection	Define when the bootstrap manifest should be regenerated, such as route changes, schema changes, or roadmap structure changes, so the bootstrap layer remains reliable instead of going stale silently.	done	small	high	{}	\N	\N	2026-03-15 13:31:52.471	2026-03-15 13:26:42.142577	2026-03-15 13:31:52.471
fafba81e-0680-4821-8e7e-74a9f283bc0e	f4d97ef5-810b-41d2-a380-a356781cb8a8	f1a21171-8741-41b1-9130-5ad9cfc28c7d	Expose active roadmap context in bootstrap output	Include live roadmap context in the bootstrap layer so agents can see current planning priorities, open backbone projects, and related workstreams before beginning new exploration.	done	small	high	{}	\N	\N	2026-03-15 13:31:52.474	2026-03-15 13:26:42.151537	2026-03-15 13:31:52.474
cdeda5a2-b882-443f-aef3-bcb917343c69	f4d97ef5-810b-41d2-a380-a356781cb8a8	95a94840-8c37-42bb-bd17-b23a426d6c03	Define durable memory format for stable repo facts	Create a structured format for persistent facts such as environment requirements, preferred commands, key modules, and established product decisions while keeping temporary findings out of durable memory.	done	medium	critical	{}	\N	\N	2026-03-15 13:35:17.051	2026-03-15 13:26:42.163461	2026-03-15 13:35:17.051
911338f4-c1f9-43c7-bff5-4145a6b5a321	f4d97ef5-810b-41d2-a380-a356781cb8a8	95a94840-8c37-42bb-bd17-b23a426d6c03	Store repeatable setup knowledge separately from transient task notes	Split stable workspace knowledge from short-lived task discoveries so agents can reuse foundational context without inheriting stale or speculative details from unrelated work.	done	small	high	{}	\N	\N	2026-03-15 13:35:17.056	2026-03-15 13:26:42.168104	2026-03-15 13:35:17.056
c7c8cdf1-e5b5-46b6-aab4-b3e73b8f8ec8	f4d97ef5-810b-41d2-a380-a356781cb8a8	95a94840-8c37-42bb-bd17-b23a426d6c03	Add verification command memory for common change types	Capture the standard verification paths for UI, server, database, and roadmap work so agents can move from implementation to validation with less repeated inspection.	done	small	medium	{}	\N	\N	2026-03-15 13:35:17.059	2026-03-15 13:26:42.173732	2026-03-15 13:35:17.059
9a08bf4c-0528-49e4-852b-9277e2050598	f4d97ef5-810b-41d2-a380-a356781cb8a8	05738f5e-37a7-42ab-83d1-acbcdd4591b0	Log repeated setup friction into analysis records	Use the existing admin analysis tables to record what agents repeatedly had to inspect, why it was needed, and whether a durable automation could remove the work next time.	done	medium	high	{}	\N	\N	2026-03-15 14:21:54.905	2026-03-15 13:26:42.182377	2026-03-15 14:21:54.905
941ecd7d-05a9-455a-a324-3689c453df83	f4d97ef5-810b-41d2-a380-a356781cb8a8	05738f5e-37a7-42ab-83d1-acbcdd4591b0	Generate session closeout improvements for future agent runs	At the end of substantial agent work, produce a compact set of candidate bootstrap and memory updates that can be accepted into the durable backbone rather than leaving learning trapped in a single session.	done	medium	medium	{}	\N	\N	2026-03-15 14:21:54.91	2026-03-15 13:26:42.210225	2026-03-15 14:21:54.91
0ffd837c-54e1-4741-b341-0c2fa194cff3	f4d97ef5-810b-41d2-a380-a356781cb8a8	46a2dfed-2b0c-4c96-81af-1c90b0dc0c59	Define guardrails for self-amending agent behavior	Require that bootstrap and planning artifacts may update automatically, but product behavior, schema changes, and broader implementation changes must still be driven by explicit roadmap work and verification.	done	small	critical	{}	\N	\N	2026-03-15 14:21:54.913	2026-03-15 13:26:42.218638	2026-03-15 14:21:54.913
710c9f8d-cb26-405a-ba2e-15139e554b69	f4d97ef5-810b-41d2-a380-a356781cb8a8	05738f5e-37a7-42ab-83d1-acbcdd4591b0	Auto-create or update roadmap tasks from repeated friction patterns	When the same setup friction appears enough times, create or update a roadmap task in the backbone project so improvement work becomes visible and accumulates instead of disappearing in chat history.	done	large	high	{}	\N	\N	2026-03-15 14:30:28.688	2026-03-15 13:26:42.205935	2026-03-15 14:30:28.688
027ea86f-9910-4667-8e54-891db2344c13	9287c136-759b-432b-b82d-2ffa8d7ef695	50d7a36d-f4ca-4883-920a-39b5810ca5ec	Upgrade document workflows with stronger metadata affordances and file handling	Document management currently depends on raw uploads, manual type selection, tag entity IDs, and separate version actions. Add drag-and-drop affordances, contextual metadata presets, searchable entity linking instead of raw IDs, clearer version history, and side-by-side metadata review for document-heavy workflows.	done	medium	high	{}	\N	\N	2026-03-15 14:51:18.937	2026-03-15 13:23:08.251167	2026-03-15 14:51:18.937
5aebc5bf-3383-4e6a-8530-6d6da173face	9287c136-759b-432b-b82d-2ffa8d7ef695	ebac5acc-3ec0-43d6-bdd4-c9decbdbd1d1	Add explicit progress and completion feedback for exports, uploads, and sync actions	Exports, uploads, sync operations, and background actions should provide more than a button click and a silent browser effect. Add pending states, completion summaries, downloadable result notices, and failure recovery paths so users can trust what happened after trigger-heavy actions.	done	small	high	{}	\N	\N	2026-03-15 14:51:18.937	2026-03-15 13:23:08.251167	2026-03-15 14:51:18.937
1ee767ef-0b4f-4627-8e5b-b17775539055	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	c56068ba-3577-4f03-a649-1d9e042ca481	Persist durable source traceability across extracted records and clauses	Link clause records and parsed outputs back to extracted records and repository documents so FTPH 4.2 remains review-first and traceable to origin.\n\nFTPH Functional Units: 4.2.2, 4.2.3\n\nImplementation Update: Delivered on 2026-03-15: ingestion jobs and clause outputs now preserve repository-document provenance when a source document is linked, and clause outputs are anchored to a concrete extracted record from the same ingestion job for durable review traceability. Remaining separate backlog scope is superseded-history lifecycle UX.	done	medium	high	{cba1ffae-5dff-43e8-8187-36e7e6c27bc9,468240c8-ac6f-40b9-a05b-de9b0d4dab55}	2026-04-27 00:00:00	2026-05-10 00:00:00	2026-03-15 13:17:36.906	2026-03-15 12:39:13.248606	2026-03-15 13:34:09.327
d01f4fec-ce2f-45f1-9b2c-578187c49442	ff940b75-154f-4b87-810a-70ebf9436de2	41c3629a-109b-464f-b880-a723399301fd	Plan explicit workflow state system across board surfaces	Define the state model and visible status treatment for access, governance tasks, meetings, notices, maintenance, and board distribution workflows.\n\nImplementation Update: Delivered: the board workspace now exposes explicit access, governance, maintenance, communications, and board-package state summaries with visible status treatment.	done	medium	high	{}	\N	\N	2026-03-15 13:43:13.823	2026-03-15 13:13:49.692884	2026-03-15 13:43:13.823
1b5c7969-6609-4d38-9075-b1b54055281a	9287c136-759b-432b-b82d-2ffa8d7ef695	ebac5acc-3ec0-43d6-bdd4-c9decbdbd1d1	Standardize loading, error, and retry states for query-driven pages	State handling varies widely across pages. Some pages show skeletons and retry guidance, while others fall back to zeros or blank sections when data is absent or a request fails. Create a shared async state pattern with skeletons, empty states, inline error panels, and retry hooks for every major page template.\n\nImplementation Update: First execution slice delivered: added a reusable async state boundary and applied it to the first wave of pages to standardize loading, empty, error, and retry treatment.	done	medium	critical	{}	\N	\N	2026-03-15 14:51:18.937	2026-03-15 13:23:08.251167	2026-03-15 14:51:18.937
754f33d0-1341-425a-9b17-2dfb28772596	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	980709db-e507-44bc-82f2-ef136cb2378e	Implement paired owner and tenant secure submission links per unit	Add distinct owner-update and tenant-submission links, token expiry, token regeneration, and unit-scoped access semantics for FTPH 1.4.1, 1.4.2, and 1.4.5.\n\nFTPH Functional Units: 1.4.1, 1.4.2, 1.4.5\n\nImplementation Update: Delivered on 2026-03-15: association admins can now generate or reuse unit-scoped owner-update and tenant-submission links from the onboarding workspace, copy those links directly, and explicitly regenerate them by revoking prior active unit-link invites. The implementation reuses onboarding invites with deliveryChannel = unit-link so expiry and token semantics stay aligned to the existing onboarding system.	done	large	high	{}	2026-03-16 00:00:00	2026-03-29 00:00:00	2026-03-15 13:41:02.596	2026-03-15 12:39:13.192284	2026-03-15 14:02:11.134
5c3c36f6-e7a3-401c-baf4-daaa932b3926	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	980709db-e507-44bc-82f2-ef136cb2378e	Build occupancy-conditional owner and multi-tenant intake forms	Support owner-occupied vs rental branching, optional second-owner capture, add/remove tenant interactions, and validation aligned to FTPH 1.4.3 and 1.4.4.\n\nFTPH Functional Units: 1.4.3, 1.4.4\n\nImplementation Update: Delivered on 2026-03-15: the public owner onboarding form now captures occupancy intent (owner-occupied, rental, or vacant), supports optional second-owner entry, and provides add/remove tenant interactions for rental units. Submission review persists the structured owner/tenant payload and approval creates the primary owner, optional second owner, and tenant occupancy records within the existing onboarding workflow.	done	large	high	{754f33d0-1341-425a-9b17-2dfb28772596}	2026-03-30 00:00:00	2026-04-12 00:00:00	2026-03-15 13:50:40.553	2026-03-15 12:39:13.19882	2026-03-15 14:02:11.14
ae62b48d-817d-47b2-9d72-ebf3a62d3b79	b6c2d9d5-3780-496f-b957-0a6b2da15da6	c001229d-45f6-4ca8-803f-ba16d7c0a5cc	ISS-010 Add standard communications templates for common notices	Create reusable templates for payment instructions and other standard association communications.	done	medium	high	{3ae018b3-2c7c-499d-992e-97beea545908}	2026-04-13 00:00:00	2026-04-24 00:00:00	2026-03-16 15:43:02.809586	2026-03-16 14:06:37.669896	2026-03-16 15:43:02.809586
b85b049c-a150-4fa2-9f70-87ef3e68ad03	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	7ffd2607-e63b-4ac3-aace-dd391efc070f	Add structured template blocks and canonical merge fields	Model header, body, footer, and signature composition plus canonical merge fields for association, unit, owner, tenant, maintenance, and intake links for FTPH 7.2.2 and 7.2.3.\n\nFTPH Functional Units: 7.2.2, 7.2.3\n\nImplementation Update: Delivered on 2026-03-15: notice templates now store optional header, footer, and signature blocks alongside the body template, and canonical merge variables are resolved server-side for association identity, unit number, owner or tenant names, maintenance link, and owner or tenant onboarding links before custom variables are applied.	done	medium	high	{9be3be61-a55c-41b8-9751-7e01458eeadd}	2026-03-30 00:00:00	2026-04-12 00:00:00	2026-03-15 14:18:59.444	2026-03-15 12:39:13.225767	2026-03-15 14:29:08.231
9be3be61-a55c-41b8-9751-7e01458eeadd	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	7ffd2607-e63b-4ac3-aace-dd391efc070f	Implement recipient targeting by role, unit scope, and board audience	Support all-owners, all-tenants, all-occupants, selected-units, individual-recipient, and board-member targeting for FTPH 7.2.1.\n\nFTPH Functional Units: 7.2.1\n\nImplementation Update: Delivered on 2026-03-15: communications recipient resolution now supports all owners, all tenants, all occupants, selected units with scoped recipient selection, individual owner, individual tenant, and board-member targeting. The communications admin UI and preview API were updated to drive those target types directly.	done	large	high	{}	2026-03-16 00:00:00	2026-03-29 00:00:00	2026-03-15 14:12:52.918	2026-03-15 12:39:13.213818	2026-03-15 14:29:08.166
dd55c61b-96cd-41ff-ae51-48338a48642e	afd38fb0-c594-4b57-8151-397146ab973d	d45579a6-88c8-43eb-9bc0-515afa09a851	Add automated vendor insurance renewal alerts	Insurance expiry dates are stored but there's no automated alert when insurance is approaching expiration. Add email alerts at 60/30/14 days before expiry to both the property manager and the vendor contact. Flag expired insurance on work order assignment.\n\n**Self-managed:** Allowing uninsured vendors to work on property is a direct liability — this is non-negotiable.	done	small	high	{}	\N	\N	\N	2026-03-17 01:44:01.84298	2026-03-17 02:08:20.753265
6209fc2d-f9d9-475c-bc2d-6e8bedfe3c8e	b6c2d9d5-3780-496f-b957-0a6b2da15da6	c001229d-45f6-4ca8-803f-ba16d7c0a5cc	ISS-011 Add association letterhead and shared header metadata to outbound messages	Standardize outbound communications with association branding and shared identifying metadata.	done	small	medium	{ae62b48d-817d-47b2-9d72-ebf3a62d3b79}	2026-04-13 00:00:00	2026-04-24 00:00:00	2026-03-16 15:44:14.856673	2026-03-16 14:06:37.669896	2026-03-16 15:44:14.856673
e5226e7d-77ab-4caf-9b68-bf410d601c06	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	7ffd2607-e63b-4ac3-aace-dd391efc070f	Enforce owner and tenant communication routing policy	Apply message-class routing rules so governance and financial notices stay owner-only while operational notices can reach tenants per FTPH 7.2.4.\n\nFTPH Functional Units: 7.2.4, 1.2.3, 1.3.2\n\nImplementation Update: Delivered on 2026-03-15: targeted communications now accept a message class and enforce owner-or-board-only delivery for financial and governance sends while allowing operational and maintenance sends to include tenants. Payment-instruction sends were tightened onto the owner-targeting model and now ride the financial message class.	done	medium	high	{9be3be61-a55c-41b8-9751-7e01458eeadd,b85b049c-a150-4fa2-9f70-87ef3e68ad03}	2026-04-13 00:00:00	2026-04-26 00:00:00	2026-03-15 14:12:52.932	2026-03-15 12:39:13.229846	2026-03-15 14:29:08.206
aa7db5bd-2ea1-421b-9259-617792bb24bb	9287c136-759b-432b-b82d-2ffa8d7ef695	425ab00f-24f7-4a79-b10f-d6b241eba756	Redesign association context switching to be more explicit and less error-prone	Association scope is important but is currently represented mostly by a header select and scattered inline labels. Introduce stronger scope signaling, page-level mismatch warnings, and module-aware empty states so users do not accidentally work in the wrong association or wonder why a page is empty.\n\nImplementation Update: First execution slice delivered: added a reusable association scope banner and applied it to the first wave of high-traffic admin pages so scope is visible before actions are taken.	done	medium	critical	{}	\N	\N	2026-03-15 14:51:18.937	2026-03-15 13:23:08.251167	2026-03-15 14:51:18.937
9daba1d8-9ffc-4aa8-88c6-829490ffc700	9287c136-759b-432b-b82d-2ffa8d7ef695	203ea1a2-b471-4d60-ad28-c4551325a065	Standardize sortable, filterable, paginated tables across operations and finance	Core lists like work orders, vendors, maintenance schedules, meetings, ledger entries, invoices, and utilities rely on plain tables with limited slicing and no shared sorting/filtering model. Build a shared data-grid pattern with column controls, filters, bulk actions, pagination, and saved views for heavy operator workflows.	done	large	critical	{}	\N	\N	2026-03-15 14:51:18.937	2026-03-15 13:23:08.251167	2026-03-15 14:51:18.937
78190b8b-df20-44d4-b31d-fd0d54e0f733	9287c136-759b-432b-b82d-2ffa8d7ef695	203ea1a2-b471-4d60-ad28-c4551325a065	Improve responsive behavior for wide admin and operations views	Many pages use dense tables and fixed multi-column metric blocks that will compress poorly on smaller screens. Define mobile and tablet patterns for tables, stacked record cards, sticky primary actions, and selective column collapse so the system remains usable outside desktop-width layouts.	done	medium	high	{}	\N	\N	2026-03-15 14:51:18.937	2026-03-15 13:23:08.251167	2026-03-15 14:51:18.937
b4f7061a-f0a1-41bd-8128-084c28d78a68	9287c136-759b-432b-b82d-2ffa8d7ef695	203ea1a2-b471-4d60-ad28-c4551325a065	Introduce drill-in side panels and row detail views to reduce context loss	Important workflows such as vendor documents, work-order editing, and onboarding review require jumping between tables, dialogs, and separate sections. Replace some edit flows with row detail drawers or side panels so users can inspect records, supporting evidence, and actions without losing list position.	done	medium	high	{}	\N	\N	2026-03-15 14:51:18.937	2026-03-15 13:23:08.251167	2026-03-15 14:51:18.937
2cf459e2-689c-462f-a4d8-7c84aeea49cd	9287c136-759b-432b-b82d-2ffa8d7ef695	50d7a36d-f4ca-4883-920a-39b5810ca5ec	Turn dense CRUD forms into guided, task-oriented flows	Several forms surface many raw fields at once, including association profile editing, owner ledger entry creation, invite creation, and document/version management. Introduce progressive disclosure, smarter defaults, inline field dependencies, and compact review steps so high-frequency tasks take less operator effort.	done	large	high	{}	\N	\N	2026-03-15 14:51:18.937	2026-03-15 13:23:08.251167	2026-03-15 14:51:18.937
3da30822-bdd6-4c9a-86e0-19b20129bf90	9287c136-759b-432b-b82d-2ffa8d7ef695	50d7a36d-f4ca-4883-920a-39b5810ca5ec	Refine onboarding and review consoles around next-best-action workflows	The association context page already assembles rich onboarding data, but invite creation, manual entry, reminder sweeps, and submission review are still spread across dense tables and forms. Reframe this around next-best actions, bulk review, exception queues, and clearer remediation guidance for blocked units.	done	medium	high	{}	\N	\N	2026-03-15 14:51:18.937	2026-03-15 13:23:08.251167	2026-03-15 14:51:18.937
956a58b6-0ea7-4523-97bf-38bd9c427035	9287c136-759b-432b-b82d-2ffa8d7ef695	ebac5acc-3ec0-43d6-bdd4-c9decbdbd1d1	Pair analytics with explanations and recommended next actions	Pages like operations, executive, roadmap, and owner ledger expose useful KPIs, but they often stop at display. Add concise explanatory copy, threshold callouts, anomaly highlighting, and linked next actions so metrics become operational guidance instead of passive readouts.	done	medium	medium	{}	\N	\N	2026-03-15 14:51:18.937	2026-03-15 13:23:08.251167	2026-03-15 14:51:18.937
b1484f64-4dc1-47ee-9211-fc3df5d3aa69	9287c136-759b-432b-b82d-2ffa8d7ef695	425ab00f-24f7-4a79-b10f-d6b241eba756	Create a global command palette for navigation, recent records, and create actions	The left navigation covers many modules and second-level routes, but discovery is still browse-first. Add a command palette for route jumps, recent entities, quick create actions, and association switching so frequent operators can move across the platform without repeated sidebar scanning.\n\nImplementation Update: First execution slice delivered: added a global workspace command palette in the shell with keyboard launch, route jump, recent-page recall, create-action shortcuts, and fast association scope switching.	done	large	high	{}	\N	\N	2026-03-15 14:51:18.937	2026-03-15 13:23:08.251167	2026-03-15 14:51:18.937
21c17182-b528-4d9a-ae9a-d70adacba21a	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	285e8632-8b6c-4257-9ee5-db15c0ece2f5	Add regulatory versioning, applicability overlays, and staleness monitoring	Preserve historical effective periods, apply association overlays, and flag overdue verification windows for FTPH 8.4.3 through 8.4.5.\n\nFTPH Functional Units: 8.4.3, 8.4.4, 8.4.5\n\nImplementation Update: Delivered on 2026-03-15: version number and year continue to govern historical record slices, association overlays remain attached through baseTemplateId plus associationId without forking the jurisdiction source record, and freshness monitoring is now visible through last verified dates, next review due dates, and stale-record counts in the compliance workspace.	done	large	high	{9d7dc7fa-e7c7-4ed1-b56b-15e09338169e}	2026-04-13 00:00:00	2026-04-26 00:00:00	2026-03-15 14:41:11.277	2026-03-15 12:39:13.275581	2026-03-15 14:51:52.995
e7d18e98-897b-41b6-bff9-34f27a766c6f	afd38fb0-c594-4b57-8151-397146ab973d	d45579a6-88c8-43eb-9bc0-515afa09a851	Add work order status notifications to requesting residents	When a resident submits a maintenance request, they receive no status updates. Add automated notifications when: request is converted to work order, vendor is assigned, work is completed. Notification should go via email and appear in the owner portal.\n\n**Self-managed:** 'Where is my repair?' is the #1 resident complaint in HOAs.	done	medium	high	{}	\N	\N	\N	2026-03-17 01:44:01.849864	2026-03-17 01:44:01.849864
9d7dc7fa-e7c7-4ed1-b56b-15e09338169e	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	285e8632-8b6c-4257-9ee5-db15c0ece2f5	Implement jurisdiction sync, review, and publication workflow	Fetch or stage regulatory updates from authoritative sources, review changes, and publish approved records for FTPH 8.4.2.\n\nFTPH Functional Units: 8.4.2\n\nImplementation Update: Delivered on 2026-03-15: the regulatory library sync path now upserts managed CT, FL, and CA source-backed records instead of anonymous static seeds, refreshes item-level source citations, and marks synced records as reviewed and published. The governance compliance UI now surfaces source metadata and supports review-to-published lifecycle actions for selected regulatory records.	done	large	high	{611d7a48-45dd-4fd4-ada5-77eba2266a20}	2026-03-30 00:00:00	2026-04-12 00:00:00	2026-03-15 14:41:11.272	2026-03-15 12:39:13.271931	2026-03-15 14:51:52.987
1e9d92e7-68af-4c50-9b3d-0f561da2bbc5	b6c2d9d5-3780-496f-b957-0a6b2da15da6	3985ebd6-efea-41bb-8e77-fce83afdea1d	ISS-002 Preserve workspace redirect after authentication	Fix post-auth redirect handling so successful login lands in the intended workspace instead of the public landing page.	done	medium	critical	{401ae223-dd62-4d3b-b76a-99ede62b8ba8}	2026-03-16 00:00:00	2026-03-27 00:00:00	2026-03-16 14:39:16.384	2026-03-16 14:06:37.669896	2026-03-16 14:06:37.669896
66a2e204-9cb5-4425-8203-dcea20ed602b	e1bbe890-04bd-4448-bed8-beb513dfb2bd	3ce02e26-8cf2-4002-8480-197da3a91f43	Replace default admin API key fallback with environment-required auth	The platform currently falls back to a shared dev admin key and default admin identity. Require configured credentials and move to a real authenticated admin session model.	done	large	critical	{}	\N	\N	\N	2026-03-07 21:55:08.689468	2026-03-16 13:41:12.522
cb6aa9aa-aa12-4fd7-9efa-85cdc5e5d4a2	afd38fb0-c594-4b57-8151-397146ab973d	eda03077-4bd5-4bab-b034-c3c849f2aea7	Build automated payment reminder sequence	There is no automated payment reminder workflow. Build a configurable sequence: (1) dues notice 5 days before due date, (2) first reminder 3 days past due, (3) second reminder 14 days past due, (4) late fee notice when applied. Each template should pull owner name, amount, and payment link dynamically.\n\n**PM perspective:** Collection rate improvement is the #1 ROI feature for management companies.\n**Self-managed:** Manual reminder calls are the most time-consuming board task.	done	large	critical	{}	\N	\N	\N	2026-03-17 01:44:01.961425	2026-03-17 01:44:01.961425
a2791550-33cf-4fb7-a52a-6f97ff77016e	b6c2d9d5-3780-496f-b957-0a6b2da15da6	4e3e7a47-a1bd-47a9-b05d-d83fb0b47843	ISS-006 Make global search route to relevant records and modules	Replace hard-coded communications routing with actual search resolution logic for routes such as units and related record destinations.	done	medium	high	{07661235-abb2-4e77-ae17-9cf3a90e638d}	2026-03-30 00:00:00	2026-04-10 00:00:00	2026-03-16 15:45:13.568197	2026-03-16 14:06:37.669896	2026-03-16 15:45:13.568197
7c903fa2-1c6d-4dbc-8759-e038f1c7df6c	afd38fb0-c594-4b57-8151-397146ab973d	d45579a6-88c8-43eb-9bc0-515afa09a851	Build preventive maintenance schedule and asset registry	There's a maintenance schedules page but no underlying asset registry. Add common association assets (HVAC, roof, elevator, pool, etc.) with expected service intervals. Generate preventive maintenance work orders automatically per schedule.\n\n**PM perspective:** Preventive maintenance tracking is a contractual obligation in management agreements.	done	large	medium	{}	\N	\N	\N	2026-03-17 01:44:01.952091	2026-03-17 01:44:01.952091
1cfdb5e2-78f3-4c11-a340-aa58668a919d	b6c2d9d5-3780-496f-b957-0a6b2da15da6	3985ebd6-efea-41bb-8e77-fce83afdea1d	ISS-004 Remove or redesign the unclear refresh Google session control	Replace the post-login refresh control with a clearer session-state treatment or remove it if it is not an operator action.	done	small	medium	{1e9d92e7-68af-4c50-9b3d-0f561da2bbc5}	2026-04-13 00:00:00	2026-04-24 00:00:00	2026-03-16 14:39:16.388	2026-03-16 14:06:37.669896	2026-03-16 14:06:37.669896
caf1c497-1449-4d1a-a1d7-5e335fc4fb0e	b6c2d9d5-3780-496f-b957-0a6b2da15da6	38142c16-2f37-4915-a501-7488dc711ea7	ISS-019 Synchronize approved owners into the people registry	Ensure owner approvals update the people registry consistently so owner and person datasets do not drift apart.	done	medium	high	{f47eafe3-dc98-4055-b7c9-a83629f05245}	2026-03-16 00:00:00	2026-03-27 00:00:00	2026-03-16 14:57:43.697	2026-03-16 14:06:37.669896	2026-03-16 14:06:37.669896
0f2658af-a75e-4b4e-b10c-e90ffd5e1c8d	b6c2d9d5-3780-496f-b957-0a6b2da15da6	3985ebd6-efea-41bb-8e77-fce83afdea1d	ISS-003 Remove debug-style UI residue from the landing page	Remove developer-facing or irrelevant debug elements from the public landing page experience.	done	small	medium	{1e9d92e7-68af-4c50-9b3d-0f561da2bbc5}	2026-04-13 00:00:00	2026-04-24 00:00:00	2026-03-16 15:43:02.809586	2026-03-16 14:06:37.669896	2026-03-16 15:43:02.809586
69854552-fa03-44c6-a0ed-d753e0feea67	b6c2d9d5-3780-496f-b957-0a6b2da15da6	953b8170-1993-4f36-bc24-06599caf72fa	ISS-014 Move second-owner fields into the ownership section	Reorganize the onboarding layout so additional ownership inputs are grouped with ownership rather than occupancy.	done	small	medium	{d0280de2-5ae0-4da3-b2a1-0a5b5a1ba9de}	2026-04-13 00:00:00	2026-04-24 00:00:00	2026-03-16 15:46:03.057457	2026-03-16 14:06:37.669896	2026-03-16 15:46:03.057457
07661235-abb2-4e77-ae17-9cf3a90e638d	b6c2d9d5-3780-496f-b957-0a6b2da15da6	4e3e7a47-a1bd-47a9-b05d-d83fb0b47843	ISS-005 Load all accessible associations in the workspace selector	Investigate association loading and permission filtering so users see every association they are allowed to manage.	done	medium	high	{}	2026-03-16 00:00:00	2026-03-27 00:00:00	2026-03-16 15:56:25.877425	2026-03-16 14:06:37.669896	2026-03-16 15:56:25.877425
9aeae555-8586-4757-b46e-f4fb69daa721	b6c2d9d5-3780-496f-b957-0a6b2da15da6	4e3e7a47-a1bd-47a9-b05d-d83fb0b47843	ISS-021 Connect owner row selection to owner detail navigation	Bind owner list rows to the owner detail route so operators can inspect and edit owner records directly from the list.	done	small	high	{caf1c497-1449-4d1a-a1d7-5e335fc4fb0e}	2026-03-30 00:00:00	2026-04-10 00:00:00	2026-03-16 15:28:08.021931	2026-03-16 14:06:37.669896	2026-03-16 15:28:08.021931
110d6200-73f2-4943-97b5-57dd74ee1ec2	b6c2d9d5-3780-496f-b957-0a6b2da15da6	3d11b1f0-048f-4d01-b1a8-5ae7510d2528	ISS-035 Repair governance permission evaluation for assigned admins	Investigate role mapping and permission checks so governance actions recognize accounts that already hold admin rights.	done	medium	high	{}	2026-03-16 00:00:00	2026-03-27 00:00:00	2026-03-16 15:02:39.136952	2026-03-16 14:20:26.465594	2026-03-16 15:02:39.136952
f47eafe3-dc98-4055-b7c9-a83629f05245	b6c2d9d5-3780-496f-b957-0a6b2da15da6	953b8170-1993-4f36-bc24-06599caf72fa	ISS-017 Make onboarding submissions appear immediately in the owner list	Repair onboarding submission synchronization so newly submitted records are visible in the expected owner list without delayed propagation.	done	large	high	{d0280de2-5ae0-4da3-b2a1-0a5b5a1ba9de}	2026-03-16 00:00:00	2026-03-27 00:00:00	2026-03-16 14:57:43.688	2026-03-16 14:06:37.669896	2026-03-16 14:06:37.669896
d0280de2-5ae0-4da3-b2a1-0a5b5a1ba9de	b6c2d9d5-3780-496f-b957-0a6b2da15da6	953b8170-1993-4f36-bc24-06599caf72fa	ISS-013 Add clear labels and remove ambiguous prefills in owner onboarding	Make every onboarding field explicit, remove unexplained default values, and restore basic form legibility for operators.	done	medium	high	{}	2026-03-16 00:00:00	2026-03-27 00:00:00	2026-03-16 14:39:16.392	2026-03-16 14:06:37.669896	2026-03-16 14:06:37.669896
3c20e5b6-de10-4457-a423-d2b3670f581d	b6c2d9d5-3780-496f-b957-0a6b2da15da6	0c78fc58-df34-48e9-9a0a-a95ee50bba03	ISS-029 Fix meeting creation failures in the scheduler	Investigate meeting submission validation and API handling so scheduling a meeting succeeds without system errors.	done	medium	high	{}	2026-03-16 00:00:00	2026-03-27 00:00:00	2026-03-16 14:39:16.4	2026-03-16 14:20:26.470473	2026-03-16 14:20:26.470473
63c771e5-924f-42bf-b4c3-c8e25fb9a387	b6c2d9d5-3780-496f-b957-0a6b2da15da6	0c78fc58-df34-48e9-9a0a-a95ee50bba03	ISS-031 Seed representative meeting data for test and demo environments	Populate sample meeting records so the meeting interface is understandable when the environment has no organic governance history yet.	done	small	medium	{3c20e5b6-de10-4457-a423-d2b3670f581d}	2026-03-30 00:00:00	2026-04-10 00:00:00	2026-03-16 15:31:04.878533	2026-03-16 14:20:26.496589	2026-03-16 15:31:04.878533
f659eb6d-6ac8-4eb2-b9ad-77ab9a17bd1d	b6c2d9d5-3780-496f-b957-0a6b2da15da6	de0a72fe-a173-4333-b537-a949dc771dd4	ISS-028 Evaluate simplification of board package generation dependencies	Review whether board package generation is too tightly coupled to other modules and simplify the workflow where the dependency chain is not justified.	done	medium	medium	{a51d475f-47fb-43f9-9442-07b9726c9d52}	2026-04-27 00:00:00	2026-05-08 00:00:00	2026-03-16 16:10:20.95238	2026-03-16 14:20:26.541993	2026-03-16 16:10:20.95238
99025d56-96d4-42f8-9adf-c6e5ddcb012a	b6c2d9d5-3780-496f-b957-0a6b2da15da6	77181305-2ac4-4fa6-8439-68f1183a064e	ISS-039 Review and align inter-module data relationships	Conduct a platform architecture review across governance, meetings, owners, and compliance modules to reduce fragmented workflows and unclear data dependencies.	done	large	high	{6de3d51a-e9e9-4335-a3d7-ac25b3873af0,85006890-6313-4b33-b867-c3b32f2f613b,f659eb6d-6ac8-4eb2-b9ad-77ab9a17bd1d}	2026-04-27 00:00:00	2026-05-08 00:00:00	2026-03-16 16:10:20.95238	2026-03-16 14:20:26.546704	2026-03-16 16:10:20.95238
c77a2d62-d452-4d03-a242-45937ff0de9f	b6c2d9d5-3780-496f-b957-0a6b2da15da6	38142c16-2f37-4915-a501-7488dc711ea7	ISS-020 Enforce ownership percentage validation per unit	Block ownership states where combined owner percentages exceed 100 percent for the same unit and surface a clear validation error.	done	medium	high	{}	2026-03-16 00:00:00	2026-03-27 00:00:00	2026-03-16 15:05:10.602552	2026-03-16 14:06:37.669896	2026-03-16 15:05:10.602552
0efd3038-6dc0-4880-913c-9c901213dba3	b6c2d9d5-3780-496f-b957-0a6b2da15da6	953b8170-1993-4f36-bc24-06599caf72fa	ISS-016 Remove emergency-contact collection from owner onboarding	Reduce low-value data capture in onboarding by removing the emergency contact field from the workflow.	done	small	low	{d0280de2-5ae0-4da3-b2a1-0a5b5a1ba9de}	2026-04-13 00:00:00	2026-04-24 00:00:00	2026-03-16 15:29:19.894542	2026-03-16 14:06:37.669896	2026-03-16 15:29:19.894542
63222ee6-3306-4160-ae66-547819b85977	b6c2d9d5-3780-496f-b957-0a6b2da15da6	de0a72fe-a173-4333-b537-a949dc771dd4	ISS-025 Explain the scheduled sweep control in board packages	Add contextual help or tooltips so operators understand what the scheduled sweep action does before using it.	done	small	medium	{}	2026-03-30 00:00:00	2026-04-10 00:00:00	2026-03-16 15:11:37.122816	2026-03-16 14:20:26.528104	2026-03-16 15:11:37.122816
87871376-c368-4a9a-891b-e470c92d0e80	afd38fb0-c594-4b57-8151-397146ab973d	eda03077-4bd5-4bab-b034-c3c849f2aea7	Add template variable reference panel to notice editor	Notice templates use {{variables}} but there's no documented list of available variables in the UI. Users must guess variable names. Add a sidebar panel showing all available variables with descriptions and example values. Validate variables at save time.\n\n**Self-managed:** Boards send notices with broken {{variables}} due to typos — this is an embarrassment.	done	small	high	{}	\N	\N	\N	2026-03-17 01:44:01.96419	2026-03-17 02:19:28.884692
ee1c2066-0b65-4a07-8088-3e25d6780f3d	b6c2d9d5-3780-496f-b957-0a6b2da15da6	3d11b1f0-048f-4d01-b1a8-5ae7510d2528	ISS-023 Fix board role assignment date validation	Investigate date parsing and API schema validation so valid board-role assignment inputs do not fail with a 400 invalid date error.	done	medium	high	{}	2026-03-16 00:00:00	2026-03-27 00:00:00	2026-03-16 14:39:16.396	2026-03-16 14:20:26.445157	2026-03-16 14:20:26.445157
a51d475f-47fb-43f9-9442-07b9726c9d52	b6c2d9d5-3780-496f-b957-0a6b2da15da6	de0a72fe-a173-4333-b537-a949dc771dd4	ISS-027 Investigate board package delivery status versus inbox receipt	Verify delivery logs, email provider behavior, and status reporting so package-delivery success reflects actual receipt outcomes.	done	medium	high	{}	2026-04-13 00:00:00	2026-04-24 00:00:00	2026-03-16 15:20:52.373561	2026-03-16 14:20:26.537413	2026-03-16 15:20:52.373561
d863795c-fd71-450d-89ac-c8a71be3c3fb	b6c2d9d5-3780-496f-b957-0a6b2da15da6	de0a72fe-a173-4333-b537-a949dc771dd4	ISS-026 Add usage guidance for board package workflows	Create how-to guidance and contextual support for creating, generating, and distributing board packages.	done	medium	high	{}	2026-03-30 00:00:00	2026-04-10 00:00:00	2026-03-16 15:11:37.122816	2026-03-16 14:20:26.532865	2026-03-16 15:11:37.122816
d4421674-f004-4389-803e-20ea332da970	b6c2d9d5-3780-496f-b957-0a6b2da15da6	77181305-2ac4-4fa6-8439-68f1183a064e	ISS-040 Add WIP feature visibility controls for non-admin users	Implement feature-gating controls so unfinished modules do not appear to non-admin users before they are operationally ready.	done	medium	high	{99025d56-96d4-42f8-9adf-c6e5ddcb012a}	2026-04-27 00:00:00	2026-05-08 00:00:00	2026-03-16 15:22:18.442413	2026-03-16 14:20:26.552953	2026-03-16 15:22:18.442413
401ae223-dd62-4d3b-b76a-99ede62b8ba8	b6c2d9d5-3780-496f-b957-0a6b2da15da6	3985ebd6-efea-41bb-8e77-fce83afdea1d	ISS-001 Prevent duplicate Google sign-in window launches during login	Investigate OAuth flow triggers and ensure authentication opens only one Google sign-in window per login attempt.	done	medium	high	{}	2026-03-16 00:00:00	2026-03-27 00:00:00	2026-03-16 14:39:16.378	2026-03-16 14:06:37.669896	2026-03-16 14:06:37.669896
e3439e0a-c594-4b96-b6e4-32466fc71d08	afd38fb0-c594-4b57-8151-397146ab973d	eda03077-4bd5-4bab-b034-c3c849f2aea7	Add delivery tracking and bounce handling to notices	Emails are sent but there's no visibility into delivery status, open rates, or bounces. Add per-send tracking: sent count, delivered, opened, bounced, unsubscribed. Flag bounced addresses for contact update. For legal notices, add proof-of-mailing report.\n\n**PM perspective:** 'We sent the notice' requires proof for disputes and hearings.	done	medium	high	{}	\N	\N	\N	2026-03-17 01:44:01.970081	2026-03-17 01:44:01.970081
ab5f73b6-7126-471c-a432-de40430d65e7	afd38fb0-c594-4b57-8151-397146ab973d	eda03077-4bd5-4bab-b034-c3c849f2aea7	Add emergency mass notification capability	There's no way to send urgent/emergency notifications. Add an 'Emergency Alert' workflow for situations like water shutoff, building access issues, or safety events. Should support: all units in a building, all association members, with immediate send (no scheduling delay).\n\n**Self-managed:** A burst pipe at 11pm requires immediate mass notification — no current path exists.	done	medium	high	{}	\N	\N	\N	2026-03-17 01:44:01.975001	2026-03-17 01:44:01.975001
fb643485-efc2-47d5-bfd1-477f1533b724	b6c2d9d5-3780-496f-b957-0a6b2da15da6	953b8170-1993-4f36-bc24-06599caf72fa	ISS-015 Replace free-text mailing address with structured address fields	Capture mailing address data as structured street, city, state, and ZIP components instead of a single free-text field.	done	medium	medium	{d0280de2-5ae0-4da3-b2a1-0a5b5a1ba9de}	2026-03-30 00:00:00	2026-04-10 00:00:00	2026-03-16 15:29:19.894542	2026-03-16 14:06:37.669896	2026-03-16 15:29:19.894542
3ae018b3-2c7c-499d-992e-97beea545908	b6c2d9d5-3780-496f-b957-0a6b2da15da6	c001229d-45f6-4ca8-803f-ba16d7c0a5cc	ISS-009 Move payment method registry ownership into finance	Relocate payment method registry functionality from communications into the finance area where operators expect it.	done	medium	medium	{}	2026-04-13 00:00:00	2026-04-24 00:00:00	2026-03-16 15:56:25.877425	2026-03-16 14:06:37.669896	2026-03-16 15:56:25.877425
8e934ca3-5780-4b57-abc8-df1cfa197b0f	afd38fb0-c594-4b57-8151-397146ab973d	1b77553b-18a3-4a71-a1ba-4df3ab634103	Add document access to owner portal	Owners have no way to access association documents (CC&Rs, rules, meeting minutes) through the portal. Add a 'Documents' section in the portal that shows documents with portal visibility set to 'owner' or 'public', with category filtering.\n\n**Self-managed:** 'Where are the rules?' is the most common new-owner question — portal access eliminates it.	done	medium	high	{}	\N	\N	\N	2026-03-17 01:44:01.983848	2026-03-17 01:44:01.983848
283b19ea-697d-4d10-8db9-aff234e4edb8	afd38fb0-c594-4b57-8151-397146ab973d	eda03077-4bd5-4bab-b034-c3c849f2aea7	Build notice template library with pre-built HOA templates	The system has 3 hardcoded templates. Add a library of 20+ pre-built templates: annual meeting notice, special assessment notice, rule violation notice, welcome letter, payment reminder series, maintenance notice, insurance request, move-in/move-out notice. Organize by category.\n\n**Self-managed:** Boards don't know what legally required notices look like — pre-built templates reduce risk.	done	large	high	{}	\N	\N	\N	2026-03-17 01:44:01.972596	2026-03-17 01:44:01.972596
6de3d51a-e9e9-4335-a3d7-ac25b3873af0	b6c2d9d5-3780-496f-b957-0a6b2da15da6	3d11b1f0-048f-4d01-b1a8-5ae7510d2528	ISS-024 Allow board role assignment from owner and people management	Move or duplicate board-role assignment controls into the owner or people workflow where board members are managed.	done	medium	medium	{ee1c2066-0b65-4a07-8088-3e25d6780f3d}	2026-03-30 00:00:00	2026-04-10 00:00:00	2026-03-16 15:30:17.808979	2026-03-16 14:20:26.457352	2026-03-16 15:30:17.808979
27d19664-cf48-4d56-9a68-2ee9c163a8a9	afd38fb0-c594-4b57-8151-397146ab973d	1b77553b-18a3-4a71-a1ba-4df3ab634103	Add online payment capability to owner portal	The owner portal shows account balance but has no payment functionality. Connect the payment link generation workflow to display a 'Pay Now' button on the owner portal dashboard that shows current balance and accepts payment.\n\n**PM perspective:** Online payment is the single highest-impact resident-facing feature.\n**Self-managed:** Reduces check collection, manual posting, and deposit runs.	done	large	critical	{}	\N	\N	\N	2026-03-17 01:44:01.981391	2026-03-17 01:44:01.981391
4972ac33-78cf-4415-b263-00e5546245f7	afd38fb0-c594-4b57-8151-397146ab973d	1b77553b-18a3-4a71-a1ba-4df3ab634103	Add owner portal onboarding flow for new residents	New owners/tenants gain portal access but see a blank dashboard with no guidance. Add a first-login onboarding flow: (1) confirm contact info, (2) set notification preferences, (3) review key documents (rules, move-in checklist), (4) see payment methods available.\n\n**Self-managed:** Board members spend hours onboarding new residents — portal onboarding eliminates most of this.	done	medium	high	{}	\N	\N	\N	2026-03-17 01:44:01.993011	2026-03-17 01:44:01.993011
85006890-6313-4b33-b867-c3b32f2f613b	b6c2d9d5-3780-496f-b957-0a6b2da15da6	38142c16-2f37-4915-a501-7488dc711ea7	ISS-022 Redesign the residential data model around unit-scoped relationships	Clarify how units, owners, tenants, occupancy, and people relate so the domain model matches condo operations and avoids duplicate or conflicting records.	done	large	high	{caf1c497-1449-4d1a-a1d7-5e335fc4fb0e,c77a2d62-d452-4d03-a242-45937ff0de9f}	2026-04-27 00:00:00	2026-05-08 00:00:00	2026-03-16 16:10:20.95238	2026-03-16 14:06:37.669896	2026-03-16 16:10:20.95238
3791718e-ec2b-4f4a-a2bd-a95182d378c1	b6c2d9d5-3780-496f-b957-0a6b2da15da6	4e3e7a47-a1bd-47a9-b05d-d83fb0b47843	ISS-007 Redesign the associations overview around association-level KPIs	Update the associations page so the overview reflects association health and context instead of irrelevant owner-centric metrics.	done	medium	medium	{07661235-abb2-4e77-ae17-9cf3a90e638d}	2026-04-13 00:00:00	2026-04-24 00:00:00	2026-03-16 15:56:25.877425	2026-03-16 14:06:37.669896	2026-03-16 15:56:25.877425
329473c1-b332-4678-a33f-6d08da6258ff	afd38fb0-c594-4b57-8151-397146ab973d	1b77553b-18a3-4a71-a1ba-4df3ab634103	Add account statement and payment history view in portal	Owners cannot see their payment history or account statement in the portal. Add a paginated transaction history showing: date, description, amount, running balance, and payment method. Allow export to PDF.\n\n**PM perspective:** 'What did I pay?' is the most common owner question — portal self-service eliminates the support call.	done	medium	high	{}	\N	\N	\N	2026-03-17 01:44:01.995752	2026-03-17 01:44:01.995752
56cb3d75-aed8-4299-95cc-57fe89a647ad	afd38fb0-c594-4b57-8151-397146ab973d	06638de9-2a14-4269-b6d5-ce5747d3bf66	Add confirmation/review screens before irreversible actions	Several critical actions have no confirmation: distributing a board package, sending a bulk notice, ratifying a budget, voiding an invoice. Add a confirmation step that shows a summary of what will happen and who will be affected, with a required explicit confirmation.\n\n**PM perspective:** Accidental sends to all owners of a wrong notice are client-relationship crises.	done	medium	high	{}	\N	\N	\N	2026-03-17 01:44:02.170682	2026-03-17 02:21:12.582725
ba983811-5c49-4c9c-897d-00473eff638d	afd38fb0-c594-4b57-8151-397146ab973d	d4f34e0b-9c2d-494e-a3e0-eaeb060a37b4	Add CSV/Excel export to all data tables	No data table in the application supports export. Add CSV export to: owner ledger, fee schedule, delinquency report, work order list, vendor list, compliance tasks, meeting list. This is foundational for accountants, attorneys, and board member review.\n\n**Self-managed:** Boards need to present data at annual meetings — lack of export forces manual transcription.	done	medium	high	{}	\N	\N	\N	2026-03-17 01:44:02.154218	2026-03-17 02:23:50.689765
75fec099-3457-4061-ad90-13d1ea4067fc	afd38fb0-c594-4b57-8151-397146ab973d	d4f34e0b-9c2d-494e-a3e0-eaeb060a37b4	Add visible audit trail / change history to financial records	Financial records (ledger entries, budget amounts, fee schedules) can be modified without any change history visible to users. While audit_logs exist in the database, they're not surfaced in the UI. Add a 'History' tab or expandable row on financial records showing who changed what and when.\n\n**PM perspective:** CPA audit requirements include change logs — this is a compliance necessity for managed accounts.\n**Self-managed:** Board member accountability requires transparency in financial edits.	done	medium	critical	{}	\N	\N	\N	2026-03-17 01:44:02.002513	2026-03-17 02:25:18.365695
fd6d2099-b8d2-4ab1-b2af-a71254793ee9	afd38fb0-c594-4b57-8151-397146ab973d	d4f34e0b-9c2d-494e-a3e0-eaeb060a37b4	Improve empty state messaging with actionable next steps	Empty states across the app say 'No [X] yet' but don't explain what to do first, in what order, or why it matters. Rewrite all empty states with: (1) what this section is for, (2) what you need to set up first, (3) a direct action button.\n\n**Self-managed:** Most module abandonment happens on first visit when the page is empty and there's no guidance.	done	small	medium	{}	\N	\N	\N	2026-03-17 01:44:02.160097	2026-03-17 01:44:02.160097
4072df6d-764b-4698-a615-a55c92d19ec1	afd38fb0-c594-4b57-8151-397146ab973d	d4f34e0b-9c2d-494e-a3e0-eaeb060a37b4	Add bulk CSV import for owner/unit data	Owner and unit data must be entered one record at a time. Add CSV import for: (1) units with building assignment, (2) owners with unit/ownership linkage, (3) ledger entries for balance migration. Include validation preview before committing.\n\n**PM perspective:** Onboarding a new 200-unit association requires importing data — one-by-one entry is not viable.	done	large	high	{}	\N	\N	\N	2026-03-17 01:44:02.156995	2026-03-17 01:44:02.156995
43d42fd9-be88-44e8-839a-17148f4dd16d	afd38fb0-c594-4b57-8151-397146ab973d	d4f34e0b-9c2d-494e-a3e0-eaeb060a37b4	Add orphaned record warnings and data relationship validation	Deleting a vendor doesn't warn about assigned work orders. Removing an owner doesn't check for ledger balances. Add relationship validation: warn before deleting entities that have dependent records, and run a background orphan-detection sweep that flags data anomalies on the dashboard.\n\n**PM perspective:** Orphaned data causes reconciliation issues discovered months later.	done	medium	high	{}	\N	\N	\N	2026-03-17 01:44:02.150259	2026-03-17 01:44:02.150259
7ed56c08-c144-4493-82ee-159571686a25	afd38fb0-c594-4b57-8151-397146ab973d	d4f34e0b-9c2d-494e-a3e0-eaeb060a37b4	Add insurance tracking for association-level policies (D&O, fidelity bond, master policy)	Vendor insurance is tracked but there's no place to record the association's own insurance: master property policy, D&O insurance for board members, fidelity bond. Add an 'Association Insurance' section with policy details and expiry alerts.\n\n**Self-managed:** Board members are personally liable if D&O coverage lapses — this is a critical compliance gap.	done	medium	high	{}	\N	\N	\N	2026-03-17 01:44:02.163003	2026-03-17 01:44:02.163003
d832297f-7431-46fa-a87e-72c7e845828e	afd38fb0-c594-4b57-8151-397146ab973d	06638de9-2a14-4269-b6d5-ce5747d3bf66	Add global search across all modules	There is a command palette UI but no cross-module search. Property managers need to search by owner name, unit number, work order title, or vendor name and navigate directly to the record. Implement full-text search across: persons, units, work orders, vendors, meetings.\n\n**PM perspective:** 'Find owner Smith' currently requires knowing which association they're in and navigating there.	done	large	medium	{}	\N	\N	\N	2026-03-17 01:44:02.176594	2026-03-17 01:44:02.176594
8303239e-6078-4248-b94b-eda95eda52a0	b6c2d9d5-3780-496f-b957-0a6b2da15da6	c001229d-45f6-4ca8-803f-ba16d7c0a5cc	ISS-012 Rework communications layout and control grouping	Redesign the communications module so the workflow is clearer, less cluttered, and easier for operators to interpret.	done	large	medium	{ae62b48d-817d-47b2-9d72-ebf3a62d3b79,6209fc2d-f9d9-475c-bc2d-6e8bedfe3c8e}	2026-04-27 00:00:00	2026-05-08 00:00:00	2026-03-16 16:10:20.95238	2026-03-16 14:06:37.669896	2026-03-16 16:10:20.95238
09ae9c1c-fa1e-46c4-bd04-3c243f1da0d8	afd38fb0-c594-4b57-8151-397146ab973d	d4f34e0b-9c2d-494e-a3e0-eaeb060a37b4	Add two-person approval for material financial changes	Any authorized user can currently modify ledger amounts, ratify budgets, or void invoices without a second approval. Add configurable approval workflows: (1) ledger entries above a threshold require board approval, (2) budget ratification requires designated board vote record, (3) invoice approval requires manager + board-admin sign-off.\n\n**PM perspective:** Fraud prevention is a core fiduciary requirement — no dual-control is a liability.	done	large	high	{}	\N	\N	\N	2026-03-17 01:44:02.145672	2026-03-17 01:44:02.145672
b7f24486-734b-48e2-943a-18be4e180d59	afd38fb0-c594-4b57-8151-397146ab973d	43266a06-9df9-42ac-8476-4be649b5b90f	Replace static 'Recommended Actions' with data-driven alerts	The dashboard shows static suggestions (e.g., 'review coverage') regardless of actual data. Replace with live alerts: overdue work orders, delinquent accounts, compliance deadlines, and expiring vendor insurance — all scoped to the selected association.\n\n**PM perspective:** Needs a single pane showing which of their 5+ properties has fires to put out.\n**Self-managed:** A board treasurer checking in monthly should immediately see what needs attention.	done	medium	critical	{}	\N	\N	2026-03-17 01:53:11.853	2026-03-17 01:44:01.614381	2026-03-17 01:53:11.853
835faee2-d9fa-4908-82aa-8e8c13b9ea97	afd38fb0-c594-4b57-8151-397146ab973d	43266a06-9df9-42ac-8476-4be649b5b90f	Add quick-action buttons to the dashboard	Common operations — create work order, send meeting notice, post ledger entry, invite board member — should be one click from the dashboard. Currently requires navigating 2–3 levels deep.\n\n**PM perspective:** Saves 2-3 minutes per association per day across a portfolio.\n**Self-managed:** Volunteer board members coming in monthly need shortcuts, not deep menus.	done	small	high	{}	\N	\N	2026-03-17 01:53:11.853	2026-03-17 01:44:01.618617	2026-03-17 01:53:11.853
2dd713ca-6697-412a-9e65-df501b9ced5f	afd38fb0-c594-4b57-8151-397146ab973d	43266a06-9df9-42ac-8476-4be649b5b90f	Build onboarding wizard for new associations	New associations face a blank slate with no guidance on setup order. Build a step-by-step wizard: (1) Create Association, (2) Add Buildings & Units, (3) Set Financial Accounts, (4) Configure Fees, (5) Invite Board Members. Include validation gates so users can't skip critical steps.\n\n**Self-managed:** This is the single biggest adoption blocker — volunteer boards give up at step 2.	done	large	critical	{}	\N	\N	2026-03-17 01:53:11.853	2026-03-17 01:44:01.625482	2026-03-17 01:53:11.853
ac6cf309-039b-4535-a003-df12d54f3d78	afd38fb0-c594-4b57-8151-397146ab973d	52e2ea28-5058-46f2-90fa-c403fc8f28ee	Redesign Payments page — collapse 4 numbered forms into a guided workflow	The current page has 4 stacked forms labeled '0', '1', '2', '3' with no explanation of whether they're sequential, optional, or mutually exclusive. Redesign as a tabbed or wizard workflow: (A) Configure payment methods, (B) Connect payment gateway (optional), (C) Generate payment links, (D) Monitor webhooks.\n\n**PM perspective:** Technical setup should not require reading source code.\n**Self-managed:** A treasurer who set up one Zelle method is confused by Stripe webhook testing appearing on the same page.	done	medium	critical	{}	\N	\N	2026-03-17 01:58:03.122	2026-03-17 01:44:01.636093	2026-03-17 01:58:03.122
82d7a26a-f806-47f0-b356-3693bb973c0e	afd38fb0-c594-4b57-8151-397146ab973d	52e2ea28-5058-46f2-90fa-c403fc8f28ee	Connect delinquency view to communication actions	The Owner Ledger has aging buckets and delinquency analytics but zero integration with communications. A property manager should be able to: select delinquent accounts → choose notice template → send notices → log action in owner history. Currently these are completely disconnected modules.\n\n**PM perspective:** This is a core daily workflow — delinquency management — and it requires leaving the financial module entirely.	done	medium	critical	{}	\N	\N	2026-03-17 01:58:03.122	2026-03-17 01:44:01.638936	2026-03-17 01:58:03.122
443a717f-a66d-4157-8c19-61f2590b772c	afd38fb0-c594-4b57-8151-397146ab973d	d45579a6-88c8-43eb-9bc0-515afa09a851	Connect inspection findings to work order creation	Inspection findings have status (open/monitoring/resolved) but no direct link to work orders. Add a 'Create Work Order' action on open findings that pre-populates work order with finding details, location, and urgency rating.\n\n**PM perspective:** Currently requires copy-pasting inspection notes into a separate work order — creates data drift.	done	medium	high	{}	\N	\N	\N	2026-03-17 01:44:01.847243	2026-03-17 02:07:56.619727
e09c2fa9-407f-4900-86e9-90b877bab98c	afd38fb0-c594-4b57-8151-397146ab973d	bffc2f86-4632-46fa-81f0-95d6307b8d86	Add meeting notice generation integrated with Communications	Creating a meeting does not trigger any owner notice. Add a 'Generate Notice' action on the meeting form that: selects a meeting notice template, pre-fills meeting details (date, time, location, agenda), and sends via the communications module.\n\n**Self-managed:** Legally required notice is currently a fully manual, off-platform step.\n**PM perspective:** Each association may have different notice requirements (7 days, 14 days) — should be configurable.	done	medium	critical	{}	\N	\N	\N	2026-03-17 01:44:01.665306	2026-03-17 02:08:20.753265
a8e4db46-289d-432c-af79-0f33176168e8	afd38fb0-c594-4b57-8151-397146ab973d	bffc2f86-4632-46fa-81f0-95d6307b8d86	Build minutes generation from meeting notes	Meeting notes can be added but minutes must be manually composed elsewhere. Add a 'Generate Minutes' action that formats notes + resolutions + attendance into a structured minutes template. Include a minutes approval workflow: draft → board review → ratified → distributed.\n\n**PM perspective:** Eliminates hours of manual formatting per meeting.\n**Self-managed:** Boards consistently underinvest in documentation — automation increases compliance.	done	large	high	{}	\N	\N	\N	2026-03-17 01:44:01.671183	2026-03-17 02:12:15.355482
4b99ef26-05bc-4082-b194-a7448d27a712	afd38fb0-c594-4b57-8151-397146ab973d	52e2ea28-5058-46f2-90fa-c403fc8f28ee	Add financial reporting: P&L, balance sheet, collection report	There are no financial reports in the system. At minimum, add: (1) income/expense summary by period, (2) collection rate report by fee type, (3) budget vs. actual variance report (exportable to PDF/CSV), (4) AR aging report.\n\n**Self-managed:** Boards are legally required to present financials at annual meetings. Currently there's no way to generate these.\n**PM perspective:** CPA handoff requires structured reports — manual data copy is a liability.	done	large	critical	{}	\N	\N	\N	2026-03-17 01:44:01.645523	2026-03-17 02:16:15.117637
07dbde07-24e2-45ba-873d-0085055de28e	afd38fb0-c594-4b57-8151-397146ab973d	eda03077-4bd5-4bab-b034-c3c849f2aea7	Add notice preview and recipient list confirmation before send	Notices can be sent to 'all owners' without previewing who is in the recipient list or what the rendered email will look like. Add: (1) rendered preview mode for any template, (2) show exact recipient list before send, (3) require confirmation with count displayed.\n\n**PM perspective:** Sending wrong notices to wrong recipients is a client relations crisis.	done	medium	critical	{}	\N	\N	\N	2026-03-17 01:44:01.966896	2026-03-17 02:19:28.884692
34edd9c3-d534-485f-838f-66cbccee2be2	afd38fb0-c594-4b57-8151-397146ab973d	06638de9-2a14-4269-b6d5-ce5747d3bf66	Add contextual help tooltips and field descriptions to complex forms	Technical fields like 'Publishable Key', 'Webhook Secret', 'Grace Days', 'Budget Version', and 'Obligation Type' have no explanations. Add tooltip icons (?) on every non-obvious field with a plain-language explanation and example value.\n\n**Self-managed:** A treasurer who doesn't understand 'grace days' will either skip the field or set it wrong.	done	medium	high	{}	\N	\N	\N	2026-03-17 01:44:02.173424	2026-03-17 02:21:12.582725
bd200060-0e6a-483e-b854-05767d5e35c5	afd38fb0-c594-4b57-8151-397146ab973d	bffc2f86-4632-46fa-81f0-95d6307b8d86	Add compliance deadline reminders and escalation	Compliance tasks have status and due dates but no automated reminders. Add: email reminders at 30/14/7 days before deadline, escalation to property manager when overdue, and a 'compliance readiness' percentage on the dashboard.\n\n**Self-managed:** Annual meeting, audit deadline, reserve study — these slip without prompts.	done	medium	high	{}	\N	\N	\N	2026-03-17 01:44:01.676113	2026-03-17 02:27:29.924211
28cbbb6b-0767-48dd-b9e5-68b317b7a36f	b6c2d9d5-3780-496f-b957-0a6b2da15da6	4e3e7a47-a1bd-47a9-b05d-d83fb0b47843	ISS-008 Profile and reduce association detail load latency	Measure the association context/detail page load path and address slow queries or over-fetching that delay workspace readiness.	done	medium	medium	{07661235-abb2-4e77-ae17-9cf3a90e638d}	2026-03-30 00:00:00	2026-04-10 00:00:00	2026-03-16 16:10:20.95238	2026-03-16 14:06:37.669896	2026-03-16 16:10:20.95238
8d3e1538-2a0b-4480-9206-2d586e3cf11f	afd38fb0-c594-4b57-8151-397146ab973d	d45579a6-88c8-43eb-9bc0-515afa09a851	Add photo upload and before/after documentation to work orders	Work orders have no photo upload capability. Vendors and managers should be able to attach photos at different stages (reported condition, in-progress, completed). This is essential for insurance claims and vendor accountability.\n\n**PM perspective:** Photo documentation is standard in AppFolio/Buildium — its absence is a blocker for professional use.	done	medium	high	{}	\N	\N	\N	2026-03-17 01:44:01.833961	2026-03-17 01:44:01.833961
50aa3ab3-bef2-48d5-b3dc-941b2f1d35fa	afd38fb0-c594-4b57-8151-397146ab973d	1b77553b-18a3-4a71-a1ba-4df3ab634103	Add maintenance request submission from owner portal	Owners cannot submit maintenance requests through the portal. Add a form allowing owners to: describe the issue, select category, indicate urgency, and attach photos. Automatically creates a maintenance request linked to their unit.\n\n**PM perspective:** Email/phone maintenance reporting is hard to track — portal submissions create an automatic audit trail.	done	medium	high	{}	\N	\N	\N	2026-03-17 01:44:01.987602	2026-03-17 01:44:01.987602
e1e8a391-031c-4903-80a6-bf8aa5d39f92	afd38fb0-c594-4b57-8151-397146ab973d	1b77553b-18a3-4a71-a1ba-4df3ab634103	Add contact info self-update in owner portal	Owners cannot update their contact information. Contact update requests exist in the data model but there's no portal UI. Add a 'My Profile' section where owners can submit contact info changes, which route to a manager for approval before applying.\n\n**PM perspective:** Outdated contact info causes missed notices — having owners self-maintain reduces manual updates.	done	small	medium	{}	\N	\N	\N	2026-03-17 01:44:01.990143	2026-03-17 01:44:01.990143
6690a686-7240-4743-8067-9785d0b164ac	afd38fb0-c594-4b57-8151-397146ab973d	06638de9-2a14-4269-b6d5-ce5747d3bf66	Audit and fix color-only status indicators for accessibility	Status badges (work order priority, invoice status, compliance gaps) use color as the sole differentiator. Users with color vision deficiency cannot distinguish statuses. Add icon + text label to all status indicators. Conduct a full WCAG 2.1 AA audit.\n\n**PM perspective:** ADA compliance in software is increasingly a procurement requirement for large management companies.	done	medium	medium	{}	\N	\N	\N	2026-03-17 01:44:02.185331	2026-03-17 01:44:02.185331
7e921be8-9cbc-4d1d-b0fa-734bb1f65212	afd38fb0-c594-4b57-8151-397146ab973d	06638de9-2a14-4269-b6d5-ce5747d3bf66	Add saved filters and date range presets to all table views	Every list view resets to defaults on navigation. Add: (1) saved filter sets ('My open work orders', 'Delinquent accounts > 60 days'), (2) date range presets ('This month', 'This quarter', 'YTD'), (3) filter persistence within a session.\n\n**PM perspective:** Re-applying the same 5 filters on every visit is a daily friction point.	done	medium	medium	{}	\N	\N	\N	2026-03-17 01:44:02.18279	2026-03-17 01:44:02.18279
d5b63ed7-044b-4bde-8303-84b4dca54fff	afd38fb0-c594-4b57-8151-397146ab973d	06638de9-2a14-4269-b6d5-ce5747d3bf66	Add loading state indicators for long-running operations	Board package generation, bulk notice sends, and scheduled sweeps can take seconds with no feedback. Users click away thinking nothing happened. Add progress indicators or status messages for any operation that may take > 1 second.\n\n**PM perspective:** Duplicate board packages were generated by impatient users clicking the button multiple times.	done	small	medium	{}	\N	\N	\N	2026-03-17 01:44:02.179385	2026-03-17 01:44:02.179385
6f359a6d-ead2-4c23-aecf-0a2c3c4e417f	e1bbe890-04bd-4448-bed8-beb513dfb2bd	2be575d0-d5b7-41a2-bb72-afd4f8153e1b	Fix Platform Controls role mismatch for non-platform admins	The Platform Controls page fetches platform-admin-only datasets even though managers and board-admins can access the page, causing 403-driven broken states. Split privileged sections or gate the page by role.	done	medium	high	{}	\N	\N	\N	2026-03-07 21:55:08.724414	2026-03-16 13:41:12.814
06418c4e-3dea-40de-bbe0-1b3fff60ee64	afd38fb0-c594-4b57-8151-397146ab973d	d45579a6-88c8-43eb-9bc0-515afa09a851	Build vendor performance metrics dashboard	Vendors have no performance tracking. Add: (1) total work orders assigned/completed, (2) average cost per category, (3) on-time completion rate, (4) re-work frequency. Display on vendor profile and in a vendor comparison report.\n\n**PM perspective:** Bid comparisons and vendor replacement decisions require this data.	done	large	medium	{}	\N	\N	\N	2026-03-17 01:44:01.840379	2026-03-17 01:44:01.840379
0286325a-b3ca-4a0c-acf7-f041c86f3cf9	e1bbe890-04bd-4448-bed8-beb513dfb2bd	3ce02e26-8cf2-4002-8480-197da3a91f43	Fix deployed admin association picker mismatches for scoped users	A deployed admin can authenticate successfully and still fail to see an association they are directly scoped to in admin_association_scopes. Investigate the full deployed identity path across Google session restore, local admin header state, cached association queries, and environment/database alignment so scoped associations consistently appear in the workspace selector.	done	large	critical	{}	\N	\N	\N	2026-03-16 13:41:12.753643	2026-03-16 13:41:12.753643
d9db804c-7f69-4e3a-89b1-7fd4e4cc1664	130614dc-fe17-427c-bc29-dd957cf3c797	e5c52675-2e16-4e65-b0ac-a7bd6ff60c22	Build compliance gap detector across bylaws and platform records	Cross-reference extracted obligations against meetings, budgets, board terms, and checklist history to surface probable gaps.	done	large	high	{28147319-63e6-4696-992b-129915daf77c}	\N	\N	\N	2026-03-14 14:52:01.781457	2026-03-14 14:52:01.871
\.


--
-- Data for Name: admin_roadmap_workstreams; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.admin_roadmap_workstreams (id, project_id, title, description, order_index, is_collapsed, created_at, updated_at) FROM stdin;
d82033cc-3ed0-4096-96cd-cb426534f216	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	Unit Registry	\N	1	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
bb9090ec-ea74-4b89-b081-cbef52a0c8c9	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	Person Registry	\N	2	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
bd60a4ad-56b6-4f35-af7f-de0d57c1904f	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	Ownership History	\N	3	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
ee2eae57-d340-44f1-879a-f9c791a87286	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	Occupancy Contact Tracking	\N	4	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
9a954185-9d87-4874-a96f-adbd366616d9	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	Board Role Tracking	\N	5	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
88aa305f-0fed-447d-b12c-d1352e3c6120	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	Document Repository	\N	6	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
d73e3106-2d55-4aff-ae9e-3b9f9a6a6646	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	Basic Dashboard	\N	7	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
0b8f0f54-dbd3-46d5-a8d3-25b321e2a06b	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	Auth, Roles, and Audit Logging	\N	8	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
2ff685f0-9625-4864-b45a-ad4c4040584c	8bc174fd-d350-4f41-833f-fc641200ec55	HOA/Common Fee Engine	\N	0	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
de2d1957-77f3-4589-90d2-8f183abd78e9	8bc174fd-d350-4f41-833f-fc641200ec55	Assessment Engine	\N	1	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
a11a1942-708c-4aa9-93f0-fd7aeeef7642	8bc174fd-d350-4f41-833f-fc641200ec55	Late Fee Rules	\N	2	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
819ef8cb-6fd8-41a1-9fe9-f83b7cdcb8ce	8bc174fd-d350-4f41-833f-fc641200ec55	Owner Ledger	\N	3	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
68245579-abd9-419d-813b-169a57a542f7	8bc174fd-d350-4f41-833f-fc641200ec55	Expense and Invoice Tracking	\N	4	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
4a03648a-4e20-4379-a365-11935858fc6d	8bc174fd-d350-4f41-833f-fc641200ec55	Utility Payment Tracking	\N	5	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
ab01d8e7-1871-43d1-b0e1-98779e264701	8bc174fd-d350-4f41-833f-fc641200ec55	Budget Planning and Ratification	\N	6	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
e48312ae-b030-40c2-8c15-8d4de6aa540d	97747fa0-40e2-4113-b6e6-dba6e033eae4	Meeting Tracker	\N	0	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
4bca35a2-0673-4ff8-9975-1bdfde9c7e2d	97747fa0-40e2-4113-b6e6-dba6e033eae4	Notes and Minutes Repository	\N	1	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
fed365bb-178a-40e9-9efd-7fe57a6c0aa0	97747fa0-40e2-4113-b6e6-dba6e033eae4	Board Decision Log	\N	2	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
769aa68c-a3ab-4623-a92e-79d176cad1b3	97747fa0-40e2-4113-b6e6-dba6e033eae4	Annual Checklist and Compliance Engine	\N	3	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
2f98b4ba-ee22-4b73-a997-0d14a4716d9d	97747fa0-40e2-4113-b6e6-dba6e033eae4	Calendar and Task Workflows	\N	4	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
977deeb0-def2-4626-bbd6-87aa1af7c651	97747fa0-40e2-4113-b6e6-dba6e033eae4	Governance Dashboard	\N	5	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
84775f80-73cf-441d-8e88-ef41be318894	b1376498-d4d1-4400-ac8b-3b5a2ce6aea0	AI Document Ingestion	\N	0	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
4e2f4861-99c6-4ffa-ab7c-7254b844909d	b1376498-d4d1-4400-ac8b-3b5a2ce6aea0	Metadata Extraction	\N	1	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
22578483-6c12-4d97-b026-62597fcb5e51	b1376498-d4d1-4400-ac8b-3b5a2ce6aea0	Record Suggestion Engine	\N	2	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
9c7f4aaf-6124-4fb2-a0ae-13b64454d404	b1376498-d4d1-4400-ac8b-3b5a2ce6aea0	Bylaw Ingestion Foundation	\N	3	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
73a19792-8006-45e6-96bb-fa522e9631f6	b1376498-d4d1-4400-ac8b-3b5a2ce6aea0	Smart Intake Workflows	\N	4	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
92b445fe-86e9-493d-bf46-74c6233600aa	567fd831-d3fb-4867-8565-1609e8bea1c2	Owner Portal	\N	0	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
acbe49a1-381e-4534-9fca-aa4c5213b72e	567fd831-d3fb-4867-8565-1609e8bea1c2	Tenant Portal Access	\N	1	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
753bde20-ebb0-482d-a49c-d07f411a5f16	567fd831-d3fb-4867-8565-1609e8bea1c2	Communications Layer	\N	2	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
ce565bb6-6198-4524-b3a3-2de40ca482e4	567fd831-d3fb-4867-8565-1609e8bea1c2	Gmail/Email Integration	\N	3	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
a2f542b2-97ad-41be-86af-d6d957b3d998	567fd831-d3fb-4867-8565-1609e8bea1c2	Notice Templates	\N	4	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
3488d266-4320-4bdb-8065-5ad104fa3b67	567fd831-d3fb-4867-8565-1609e8bea1c2	Multi-Association Architecture	\N	5	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
ec8ea352-58d6-4a75-9875-fa7c7c3a6d7e	567fd831-d3fb-4867-8565-1609e8bea1c2	Subscription and SaaS Admin Controls	\N	6	0	2026-03-06 17:13:38.160648	2026-03-06 17:13:38.160648
b0f373fe-725e-46dc-be8f-5601175dc53a	fffb518f-1d5f-4ed1-8a3d-8eb036a1fde1	Budget Workflow	Draft, ratify, supersede, and lock budget versions with governance-ready controls.	2	0	2026-03-07 17:28:27.848229	2026-03-07 17:28:27.848229
5b4985d7-8e9c-47fb-a9d2-4397c5d424af	cbc1edfa-d07f-49b4-8e59-4ebde0a752f8	Association Setup	\N	0	0	2026-03-06 17:13:38.160648	2026-03-06 17:28:09.854
a239134c-4744-40dc-8e15-5fc57af2e90f	9efff677-7938-4f3f-8580-2bff3e3765c2	Data Model & API	Schema and endpoints for executive updates and evidence artifacts.	1	0	2026-03-07 16:12:06.455426	2026-03-07 16:12:06.455426
7dfc1759-c392-4561-9da4-2defa0b8106f	9efff677-7938-4f3f-8580-2bff3e3765c2	Executive UI	Admin page with Highlights and Defend tabs, concise formatting, and quick entry.	2	0	2026-03-07 16:12:06.598567	2026-03-07 16:12:06.598567
2b363c41-cf1c-4870-b144-d9d9508e18fa	9efff677-7938-4f3f-8580-2bff3e3765c2	Roadmap Sync Automation	Generate or refresh executive summaries from completed roadmap tasks/projects.	3	0	2026-03-07 16:12:06.613999	2026-03-07 16:12:06.613999
ba6bf2dc-d369-451c-8ef1-758754ab9e1b	9efff677-7938-4f3f-8580-2bff3e3765c2	Verification & Launch	Testing, QA, and launch readiness for executive reporting workflows.	4	0	2026-03-07 16:12:06.629192	2026-03-07 16:12:06.629192
cac1b596-e280-4d25-bbf8-97d9970e8602	d869e3c4-d366-44f9-83e6-b6da45e24b80	Audit Model Expansion	Add canonical audit log entity and event schema for all create, update, and delete operations.	1	0	2026-03-07 17:28:27.659033	2026-03-07 17:28:27.659033
8d4444eb-d064-4d14-8d78-907ce38c5d46	d869e3c4-d366-44f9-83e6-b6da45e24b80	Delete API and Safeguards	Implement explicit delete endpoints with constraints, confirmations, and soft-delete policy where needed.	2	0	2026-03-07 17:28:27.763918	2026-03-07 17:28:27.763918
dcadbc09-72d6-4a38-bd3d-a14dc047fb26	d869e3c4-d366-44f9-83e6-b6da45e24b80	Audit Enforcement and Verification	Ensure every mutating path emits audit events and is validated by tests/verification scripts.	3	0	2026-03-07 17:28:27.787338	2026-03-07 17:28:27.787338
cd3433b1-abd1-4d2f-b25a-cfc439b88253	fffb518f-1d5f-4ed1-8a3d-8eb036a1fde1	Budget Data Model	Implement Budget, BudgetLine, and BudgetVersion entities with associations and lifecycle states.	1	0	2026-03-07 17:28:27.824408	2026-03-07 17:28:27.824408
0d4b4801-1f8d-44ef-aa47-ad1c936d9dbc	fffb518f-1d5f-4ed1-8a3d-8eb036a1fde1	Budget UX and Reporting	Deliver budget pages and variance analysis connected to ledger/expense actuals.	3	0	2026-03-07 17:28:27.892814	2026-03-07 17:28:27.892814
ec61576c-d724-4268-a393-1947cd2c7830	c9a3eb98-e4da-4d17-bac9-b3a4329ed363	Governance Entity Expansion	Add meeting agenda, note, resolution, vote, and calendar entities with links to meetings/tasks.	1	0	2026-03-07 17:28:27.924947	2026-03-07 17:28:27.924947
42a0a1bb-8438-4222-8c94-a1fc4f8f9f9b	c9a3eb98-e4da-4d17-bac9-b3a4329ed363	Resolution and Vote Workflows	Track decision lifecycle from proposal to vote result and searchable history.	2	0	2026-03-07 17:28:27.973015	2026-03-07 17:28:27.973015
cb6b416f-462b-4a9d-8be4-8467f4d702e1	c9a3eb98-e4da-4d17-bac9-b3a4329ed363	Calendar and Timeline Integration	Show governance deadlines, meetings, and obligations in unified calendar/timeline views.	3	0	2026-03-07 17:28:28.01644	2026-03-07 17:28:28.01644
38bb09de-d4b0-4f8c-a679-34074fae37aa	3ae27457-bc53-46e5-8b09-e752623c97aa	Clause Data Model	Introduce clause records, clause tags, and suggested links tied to ingestion jobs and source documents.	1	0	2026-03-07 17:28:28.031905	2026-03-07 17:28:28.031905
41105d24-b247-4a4f-b5b3-a46277015f8c	3ae27457-bc53-46e5-8b09-e752623c97aa	Review and Approval Workflow	Allow admins to approve, reject, edit, and tag clause drafts from the intake review queue.	2	0	2026-03-07 17:28:28.047559	2026-03-07 17:28:28.047559
503cf11f-e63c-46e5-877d-199c15cc0d26	3ae27457-bc53-46e5-8b09-e752623c97aa	Bylaw Knowledge Reuse	Enable searching and reuse of approved clauses for governance and communications workflows.	3	0	2026-03-07 17:28:28.073744	2026-03-07 17:28:28.073744
60cec03b-5b57-42d6-a2ac-767612f7cfa6	bdcc5149-54c7-4b58-9581-e98ffaf685cc	Portal and Membership Model	Add data model for portal users, memberships, and role-scoped document access.	1	0	2026-03-07 17:28:28.096676	2026-03-07 17:28:28.096676
f4b26d41-c855-4e03-8b26-7592c2c6379c	bdcc5149-54c7-4b58-9581-e98ffaf685cc	Owner Portal UX	Deliver external portal shell for selected documents, notices, and contact update requests.	2	0	2026-03-07 17:28:28.107016	2026-03-07 17:28:28.107016
f524059e-ad96-4080-8f1f-2e19f071789d	bdcc5149-54c7-4b58-9581-e98ffaf685cc	SaaS Tenancy and Messaging	Finalize multi-association product controls with tenant config and communication threading.	3	0	2026-03-07 17:28:28.123056	2026-03-07 17:28:28.123056
3ce02e26-8cf2-4002-8480-197da3a91f43	e1bbe890-04bd-4448-bed8-beb513dfb2bd	Authentication and Session Hardening	Close high-risk authentication and session gaps in admin and portal access flows.	1	1	2026-03-07 21:55:08.590421	2026-03-16 13:41:12.364
4fb07a5a-8204-4d90-8bf0-712c8eb9c0be	e1bbe890-04bd-4448-bed8-beb513dfb2bd	Authorization Enforcement	Align modeled access controls with actual server-side enforcement.	2	1	2026-03-07 21:55:08.700011	2026-03-16 13:41:12.775
e2aaa811-ca25-4894-8c8e-d6419e7227ac	a5451dd1-b5a1-44a7-b936-f34232faf0e5	Intake Experience and Input Handling	Extend the existing intake flow without replacing the current job/review UX shell.	1	0	2026-03-09 14:19:52.119423	2026-03-09 14:34:47.416
88165f6f-dd3b-44af-bbf5-6b8008503d0e	a5451dd1-b5a1-44a7-b936-f34232faf0e5	AI Extraction and Document Type Intelligence	Replace the current limited extractor with a classifier plus schema-specific extractors, while preserving existing ingestion entities and endpoints.	2	0	2026-03-09 14:19:52.218153	2026-03-09 14:34:47.53
78091e86-1b8c-4ee7-8461-6b45d782f9f5	a5451dd1-b5a1-44a7-b936-f34232faf0e5	Module Routing and Import Execution	Expand beyond owner-roster-only imports to true cross-module routing and staged commit workflows.	3	0	2026-03-09 14:19:52.239069	2026-03-09 14:34:47.564
c7aa0a43-ddb8-4e06-bfc9-b66c32d28243	a5451dd1-b5a1-44a7-b936-f34232faf0e5	Review Workflow, Auditability, and Recovery	Keep the existing review-based operating model, but strengthen traceability and remediation controls.	4	0	2026-03-09 14:19:52.25492	2026-03-09 14:34:47.584
91084474-44ad-48fa-8ef4-b80051ab3a47	a5451dd1-b5a1-44a7-b936-f34232faf0e5	Quality Gate and Launch Readiness	Establish objective readiness criteria before enabling broad admin use.	5	0	2026-03-09 14:19:52.268426	2026-03-09 14:34:47.599
cf08a4ef-a199-488c-86a5-f1422ea293a6	25833155-96ba-4795-a8fe-3cb30d6870d8	Source Format Detection and Segmentation	Identify source structure before extraction and split mixed inputs into coherent blocks.	0	0	2026-03-09 16:54:41.198391	2026-03-09 16:54:41.198391
cfda0ef3-a905-4aed-9d2b-cfca15246391	25833155-96ba-4795-a8fe-3cb30d6870d8	Intermediate Canonical Normalization	Normalize source material into platform-oriented entities before module-specific import payloads are built.	1	0	2026-03-09 16:54:41.198391	2026-03-09 16:54:41.198391
11d9bf83-ee92-4032-a0b9-c05ef729b2aa	25833155-96ba-4795-a8fe-3cb30d6870d8	Platform Context and Destination Routing	Ground extraction in the selected association and explicitly map records into the correct platform destination.	2	0	2026-03-09 16:54:41.198391	2026-03-09 16:54:41.198391
ac7686a1-fd84-422d-840a-f472a03c1db2	25833155-96ba-4795-a8fe-3cb30d6870d8	Quality Gates, Review, and Approval Controls	Block low-quality ingestion outputs from being approved and surface why the engine made each routing decision.	3	0	2026-03-09 16:54:41.198391	2026-03-09 16:54:41.198391
c798d107-2fc0-4865-980c-6316ac80c986	e1bbe890-04bd-4448-bed8-beb513dfb2bd	Document Delivery Integrity	Fix document publishing and file lifecycle gaps that break admin and portal access flows.	4	0	2026-03-07 22:01:48.014404	2026-03-16 13:41:12.819
2be575d0-d5b7-41a2-bb72-afd4f8153e1b	e1bbe890-04bd-4448-bed8-beb513dfb2bd	Feature Integrity and Delivery	Resolve places where the UI implies production-ready behavior but the implementation is still simulated or inconsistent.	3	0	2026-03-07 21:55:08.714858	2026-03-17 03:05:01.321
6f29dc92-839d-4e56-b03e-33effe42e608	25833155-96ba-4795-a8fe-3cb30d6870d8	Benchmarking, Observability, and Regression Harness	Measure extraction quality continuously and prevent regressions on real operating formats.	4	0	2026-03-09 16:54:41.198391	2026-03-09 16:54:41.198391
8677553f-59dc-480e-8130-f3d9d2d2c36e	25833155-96ba-4795-a8fe-3cb30d6870d8	Import Safety, Remediation, and Operator Learning Loop	Ensure imports are reversible, remediable, and continuously improved from operator feedback.	5	0	2026-03-09 16:54:41.198391	2026-03-09 16:54:41.198391
492bb38a-b0f1-4ca1-962a-c89d16ddeced	a62be175-0e65-4048-b1f3-4ed3dd75339a	Launch Controls and Finance Readiness	Make the phase safe to ship, support, and scale.	5	0	2026-03-14 12:59:58.274796	2026-03-14 12:59:58.274796
e5cf2ca5-ad7f-48b1-a6ce-dcda777a150f	4ae90483-27e3-46a6-8c5f-56d57669618a	Messaging and Notification Architecture	Establish the platform communications core for outbound notifications, inbound submissions, templates, and recipient targeting.	0	0	2026-03-11 13:10:05.398441	2026-03-11 13:14:40.036
3757aa94-7f05-46ae-ba8d-2c06a7eacb04	4ae90483-27e3-46a6-8c5f-56d57669618a	Resident Data Model and Contact Collection	Close core data integrity gaps for owners, tenants, and household-level contact records required by communications and operations.	1	0	2026-03-11 13:10:05.435316	2026-03-11 13:14:40.07
fcc1380e-4f9e-41ba-8dc9-9ac84c23802f	4ae90483-27e3-46a6-8c5f-56d57669618a	Onboarding Experience and Association Visibility	Deliver the administration experience for setup completeness tracking and consolidated association-level management.	2	0	2026-03-11 13:10:05.451034	2026-03-11 13:14:40.095
d5abf9a7-9a40-4680-a3a9-6b39d1bb69de	4ae90483-27e3-46a6-8c5f-56d57669618a	Maintenance Intake and Payment Instruction Automation	Complete operational flows tied to inbound requests and automatic owner guidance for association payment setup.	3	0	2026-03-11 13:10:05.46543	2026-03-11 13:14:40.113
e2038410-480a-4486-9e2b-ff980e38888c	e6c8ac97-a9a0-452a-85e9-2dbc332a5b3f	Cleanup and Reliability	Close validation leftovers and stabilize background automation.	0	0	2026-03-11 14:18:20.88491	2026-03-11 14:18:20.88491
4e1e2199-3aa1-46aa-9ced-72f840d47d2d	d15814d0-848b-4513-9236-82b1755faa7b	Data Model and API Safety	Introduce buildings as a first-class entity and enforce safe association-bound links to units.	1	0	2026-03-12 16:20:07.33039	2026-03-12 16:20:07.33039
126b7d4f-4fb9-46ce-b8d8-3e2ee86aa357	d15814d0-848b-4513-9236-82b1755faa7b	Unit Workflow UX	Update the Units page so building capture is the required first step for new unit creation.	2	0	2026-03-12 16:20:07.355866	2026-03-12 16:20:07.355866
21a6369a-43ed-4c14-aa1b-b92be8b46f4d	d15814d0-848b-4513-9236-82b1755faa7b	Compatibility and Verification	Prevent regressions by retaining legacy behavior for existing records and validating changed flows.	3	0	2026-03-12 16:20:07.369044	2026-03-12 16:20:07.369044
037a31b4-ff27-434a-9d19-3ef8fd273432	7e5b4164-9714-412b-91a2-14ff5c5b55d6	Identity and Session Data Model	Add first-class internal user identity and external OAuth account-linking entities with durable session storage.	1	0	2026-03-12 17:56:54.04267	2026-03-12 17:56:54.04267
777d3f7a-1b89-4519-9790-edf15f3573ef	7e5b4164-9714-412b-91a2-14ff5c5b55d6	Frontend Login Experience and Recovery	Provide app-level OAuth launch flow, callback handling, and robust session restoration in constrained environments.	3	0	2026-03-12 17:56:54.243481	2026-03-12 17:56:54.243481
7981e3fa-6454-46cc-9aa4-50cbcef6560f	7e5b4164-9714-412b-91a2-14ff5c5b55d6	Workspace Bootstrap, Guardrails, and Logout	Ensure authenticated users enter initialized workspace context and protected routes enforce session-backed identity.	4	0	2026-03-12 17:56:54.263241	2026-03-12 17:56:54.263241
427d9f2d-e9e1-4966-9cee-20adb8cf269b	7e5b4164-9714-412b-91a2-14ff5c5b55d6	Migration and Cutover Plan	Move from API-key header admin auth to session-based auth without service interruption or privilege regressions.	5	0	2026-03-12 17:56:54.276798	2026-03-12 17:56:54.276798
bca90253-11f8-4420-9ce7-a6462c8ae039	a62be175-0e65-4048-b1f3-4ed3dd75339a	Payment Gateway Productionization	Replace the current validation and test-harness foundation with a real provider-backed transaction flow.	1	1	2026-03-14 12:59:58.159124	2026-03-14 14:35:37.714
de7a017b-2e9a-4ffe-b73c-ce2288ec007f	a62be175-0e65-4048-b1f3-4ed3dd75339a	Owner Payment Experience	Turn the payment foundation into a usable owner-facing payment experience inside the portal.	2	1	2026-03-14 12:59:58.20722	2026-03-14 14:35:43.181
936c0526-b7d0-4cc5-ae15-15cae70b57b4	a62be175-0e65-4048-b1f3-4ed3dd75339a	Autopay and Delinquency Automation	Move from one-off owner payments to policy-driven collection workflows.	3	1	2026-03-14 12:59:58.236203	2026-03-14 14:35:47.934
9b37c076-ce1d-4273-95b6-709310f2d808	a62be175-0e65-4048-b1f3-4ed3dd75339a	Reconciliation and Financial Reporting	Close the loop from payment collection through bank matching and board reporting.	4	1	2026-03-14 12:59:58.256369	2026-03-14 14:35:53.116
9e734dc9-fde1-433a-a9f5-417d77691cd1	91b9fef3-9fd7-418e-b306-6fb0c6118b9a	Vendor Registry and Compliance	Create the vendor domain that the platform currently lacks beyond invoice-level records.	1	1	2026-03-14 13:02:29.972938	2026-03-14 15:19:26.11
3090173b-6725-4682-9a50-e597986dc786	91b9fef3-9fd7-418e-b306-6fb0c6118b9a	Work Order Management	Add the internal operational execution layer for property issues and maintenance delivery.	2	1	2026-03-14 13:02:30.017314	2026-03-14 15:19:27.514
9399946a-f5ff-49f2-b497-afadca4d085c	91b9fef3-9fd7-418e-b306-6fb0c6118b9a	Resident Maintenance Portal	Turn the existing maintenance request feature into a complete resident-facing service workflow.	3	1	2026-03-14 13:02:30.036704	2026-03-14 15:19:29.29
fe54145e-6c20-4476-96bf-25fdb280fa90	91b9fef3-9fd7-418e-b306-6fb0c6118b9a	Operational Reporting and Launch Readiness	Make the new property-operations layer measurable, supportable, and board-usable.	5	1	2026-03-14 13:02:30.072947	2026-03-14 15:19:43.903
6d6633bd-7e42-4a62-8cc0-e7e260fb0994	91b9fef3-9fd7-418e-b306-6fb0c6118b9a	Preventive Maintenance and Inspections	Add recurring property-care workflows so the platform is not limited to reactive issue handling.	4	1	2026-03-14 13:02:30.05591	2026-03-14 15:19:48.365
066b37f4-813e-4965-98f7-8d1e4d032927	38b68bc4-7837-448e-981f-bcd55aca5bef	Discovery and Domain Rules	Define the onboarding modes, role rules, field requirements, and approval boundaries for owner and tenant intake.	1	0	2026-03-14 14:45:38.468207	2026-03-14 14:45:38.468207
62c67e19-22e7-439d-a266-d91369f549ca	38b68bc4-7837-448e-981f-bcd55aca5bef	Data Model and Security	Add the intake records, unit-bound token model, lifecycle state, auditability, and merge targets into core resident data.	2	0	2026-03-14 14:45:38.468207	2026-03-14 14:45:38.468207
6b73926a-a6d0-40e4-842f-78d70d90cfc8	38b68bc4-7837-448e-981f-bcd55aca5bef	Admin Onboarding Workspace	Give administrators a single place to manually add people, generate intake links, and monitor onboarding progress by association and unit.	3	0	2026-03-14 14:45:38.468207	2026-03-14 14:45:38.468207
7a6e5849-86bb-47ff-8198-1bdb9b1bba73	38b68bc4-7837-448e-981f-bcd55aca5bef	Outreach Automation	Use existing contact information to invite likely owners or tenants and track the communication funnel.	4	0	2026-03-14 14:45:38.468207	2026-03-14 14:45:38.468207
11eed2c2-31cb-4be3-bcb2-edf375854d1d	38b68bc4-7837-448e-981f-bcd55aca5bef	Public Intake Experience	Provide secure owner and tenant forms that are bound to a specific association and unit.	5	0	2026-03-14 14:45:38.468207	2026-03-14 14:45:38.468207
1dbf100f-a63a-4953-a085-45fdc41f8470	38b68bc4-7837-448e-981f-bcd55aca5bef	Review, Approval, and Activation	Review submitted intake, resolve duplicates, write approved records into the platform, and optionally activate portal access.	6	0	2026-03-14 14:45:38.468207	2026-03-14 14:45:38.468207
ec89263a-3b48-4de7-b3b1-5a4058141e0c	7e5b4164-9714-412b-91a2-14ff5c5b55d6	Google OAuth Backend Flow	Implement Google OAuth strategy and backend callback flow as the primary browser login contract.	2	1	2026-03-12 17:56:54.113432	2026-03-14 14:47:11.121
e0178afe-8b3f-444b-ae19-b1b89a772933	130614dc-fe17-427c-bc29-dd957cf3c797	Cross-Association Benchmarking	Surface comparative portfolio performance metrics across associations for operators managing more than one community.	5	0	2026-03-14 14:52:01.827485	2026-03-14 14:52:01.827485
96384569-2d06-4277-b2a2-4125604fb955	130614dc-fe17-427c-bc29-dd957cf3c797	Board Reporting Package Automation	Automatically compile and distribute board-ready report packages spanning financial, governance, delinquency, and maintenance data.	1	1	2026-03-14 14:52:01.720781	2026-03-14 15:21:38.168
edaba9a1-e82b-4c4f-ba15-f1798ef9d61f	130614dc-fe17-427c-bc29-dd957cf3c797	Financial Analytics and Trend Visualization	Turn the finance data model into trend and forecasting views for boards and operators.	2	1	2026-03-14 14:52:01.746469	2026-03-14 15:21:41.283
f016071d-3fd8-422d-aceb-89411966d826	d5c23cf5-75c5-4823-9e93-afd849dd150a	Access Model and Data Foundations	Add the association-scoped board-member access model and lifecycle fields needed to represent invite-driven board permissions.	1	0	2026-03-15 12:40:52.858419	2026-03-15 12:40:52.858419
e5c52675-2e16-4e65-b0ac-a7bd6ff60c22	130614dc-fe17-427c-bc29-dd957cf3c797	AI Compliance Monitor	Use ingested bylaws and governance data to identify likely compliance gaps before they become board issues.	3	1	2026-03-14 14:52:01.770006	2026-03-14 17:38:55.171
ef7c8ba4-2783-474a-a18f-a89d4cd45c41	d5c23cf5-75c5-4823-9e93-afd849dd150a	Invitation and Activation Workflow	Create the admin workflow to invite board members and activate access only after invite acceptance and active board service validation.	2	0	2026-03-15 12:40:52.889915	2026-03-15 12:40:52.889915
636e6808-dfe7-43cb-9db0-f3c619427cfa	d5c23cf5-75c5-4823-9e93-afd849dd150a	Permission Resolution and Enforcement	Resolve effective rights for owner-board members and enforce association-scoped read and write access server-side.	3	0	2026-03-15 12:40:52.90906	2026-03-15 12:40:52.90906
ca946259-c6d9-4bb5-88af-05b2010be5a6	130614dc-fe17-427c-bc29-dd957cf3c797	State-Specific Regulatory Compliance Templates	Expand compliance checklists into versioned state-aware operational templates.	4	1	2026-03-14 14:52:01.800776	2026-03-14 17:39:02.202
7a09c7b2-1533-4ea0-953c-de3bcc8c31f8	d5c23cf5-75c5-4823-9e93-afd849dd150a	Board Workspace Experience	Present a dedicated board-member association view that exposes in-scope modules without leaking platform-admin controls.	4	0	2026-03-15 12:40:52.928339	2026-03-15 12:40:52.928339
e50d2d83-99d3-4097-aa39-6339b666bc8a	d5c23cf5-75c5-4823-9e93-afd849dd150a	Audit, Verification, and Rollout	Make elevated board access traceable and verify that permission boundaries hold across affected modules.	5	0	2026-03-15 12:40:52.943055	2026-03-15 12:40:52.943055
470ec898-7f5f-4413-b348-6fe7644d7d91	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	Governance Automation and Filing Workflows	Advance the governance backlog with reminder automation, board package automation, and filing workflows built on the managed regulatory base.	4	1	2026-03-15 12:39:13.282343	2026-03-15 14:50:38.89
285e8632-8b6c-4257-9ee5-db15c0ece2f5	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	Regulatory Records and Compliance Intelligence	Managed regulatory records are now running on source-backed compliance records with authoritative URLs, review and publication state, item-level citations, version metadata, association overlays, freshness monitoring, clause-based gap detection, alert dashboards, and suppression overrides in the compliance workspace.	3	1	2026-03-15 12:39:13.264186	2026-03-15 14:51:53.005
b817054c-91ef-46d5-a9ca-ab1a92f0436b	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	Owner Experience and Community Backlog	Plan and deliver the inactive owner-experience branches that reduce management labor and extend portal utility.	5	0	2026-03-15 12:39:13.296328	2026-03-15 12:45:34.505
761bb733-b745-4ae1-b05c-0f0f9af72f0a	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	Integration and Platform Expansion Backlog	Package the remaining platform backlog around integrations, public APIs, reseller controls, and subscription operations.	6	0	2026-03-15 12:39:13.31329	2026-03-15 12:45:34.53
2c588d17-3c00-4219-bf86-51c99e7978fa	ff940b75-154f-4b87-810a-70ebf9436de2	Service Intent and Journey Backbone	Formalize the service intent, operating model, and reusable planning backbone for service-oriented roadmap work.	1	0	2026-03-15 13:13:49.574982	2026-03-15 13:13:49.574982
05383611-35c7-460a-b1d4-ec95069572b2	ff940b75-154f-4b87-810a-70ebf9436de2	Journey Review and Findings Capture	Break down the current board-member experience from the user's perspective and capture the findings and opportunities in full.	2	0	2026-03-15 13:13:49.627112	2026-03-15 13:13:49.627112
e4830d00-14df-4e24-a602-e64c787b56d4	ff940b75-154f-4b87-810a-70ebf9436de2	Product Decisions and Scope Boundaries	Lock the product-policy decisions that should guide implementation so future chunks do not drift.	3	0	2026-03-15 13:13:49.652462	2026-03-15 13:13:49.652462
41c3629a-109b-464f-b880-a723399301fd	ff940b75-154f-4b87-810a-70ebf9436de2	Board Workspace Experience Expansion Plan	Structure the implementation plan for the next experience layers needed to make the board workspace feel operationally complete.	4	0	2026-03-15 13:13:49.67199	2026-03-15 13:13:49.67199
5fa31333-cacd-4404-a01f-49d8752ad544	ff940b75-154f-4b87-810a-70ebf9436de2	Board Operating Loops Implementation Plan	Break the future implementation into concrete board-managed workflow slices that can ship in chunks.	5	0	2026-03-15 13:13:49.697761	2026-03-15 13:13:49.697761
66d30d30-90d2-477d-b039-832ce8313e99	ff940b75-154f-4b87-810a-70ebf9436de2	Verification and Working Rhythm	Turn the planning structure into an operational rhythm for future roadmap work.	6	0	2026-03-15 13:13:49.736877	2026-03-15 13:13:49.736877
203ea1a2-b471-4d60-ad28-c4551325a065	9287c136-759b-432b-b82d-2ffa8d7ef695	Data-heavy Views and Operational Throughput	Reduce friction in large operational and finance datasets by making tables more navigable, actionable, and mobile-tolerant.	1	0	2026-03-15 13:23:08.235474	2026-03-15 13:23:08.235474
50d7a36d-f4ca-4883-920a-39b5810ca5ec	9287c136-759b-432b-b82d-2ffa8d7ef695	Forms, Documents, and Guided Workflows	Convert dense CRUD forms into guided, context-aware workflows with stronger defaults, validation, and document handling.	2	0	2026-03-15 13:23:08.235474	2026-03-15 13:23:08.235474
ebac5acc-3ec0-43d6-bdd4-c9decbdbd1d1	9287c136-759b-432b-b82d-2ffa8d7ef695	Feedback, States, and User Trust	Standardize loading, error, empty, and completion feedback so the platform feels more reliable during long-running and cross-system actions.	3	0	2026-03-15 13:23:08.235474	2026-03-15 13:23:08.235474
f1a21171-8741-41b1-9130-5ad9cfc28c7d	f4d97ef5-810b-41d2-a380-a356781cb8a8	Bootstrap Snapshot and Workspace Manifest	Create a fast, machine-readable startup layer that summarizes the repo, routes, schema touchpoints, verification commands, and active roadmap context.	1	0	2026-03-15 13:26:42.115752	2026-03-15 13:26:42.115752
95a94840-8c37-42bb-bd17-b23a426d6c03	f4d97ef5-810b-41d2-a380-a356781cb8a8	Durable Working Memory and Reusable Facts	Persist the stable facts that agents repeatedly discover so they can be reused safely across sessions and contributors.	2	0	2026-03-15 13:26:42.157573	2026-03-15 13:26:42.157573
05738f5e-37a7-42ab-83d1-acbcdd4591b0	f4d97ef5-810b-41d2-a380-a356781cb8a8	Friction Logging and Closed-Loop Improvement	Turn repeated setup friction into explicit analysis and roadmap inputs that can improve the system after each interaction.	3	0	2026-03-15 13:26:42.17814	2026-03-15 13:26:42.17814
46a2dfed-2b0c-4c96-81af-1c90b0dc0c59	f4d97ef5-810b-41d2-a380-a356781cb8a8	Governance, Safety, and Backbone Adoption	Keep self-amending behavior bounded and make the backbone the standard path for roadmap-oriented agent work.	4	0	2026-03-15 13:26:42.214336	2026-03-15 13:26:42.214336
c56068ba-3577-4f03-a649-1d9e042ca481	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	AI Ingestion Completion and Traceability	AI ingestion backlog is largely delivered: raw-source support, importer coverage, durable provenance, reprocess integrity, monitoring, and cleanup are in place. Remaining work is optional expansion to additional binary formats.	2	1	2026-03-15 12:39:13.236963	2026-03-15 14:50:18.718
4e3e7a47-a1bd-47a9-b05d-d83fb0b47843	b6c2d9d5-3780-496f-b957-0a6b2da15da6	Association Context and Navigation	Fix association selection, search routing, overview relevance, performance, and record navigation bindings.	1	0	2026-03-16 14:06:37.64337	2026-03-16 14:06:37.64337
7ffd2607-e63b-4ac3-aace-dd391efc070f	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	Communications Routing and Payment Guidance	Communications routing and payment guidance are delivered: recipient targeting by role, selected units, individual resident, and board audience; owner-vs-tenant routing policy by message class; structured template blocks with canonical merge variables; structured owner payment setup guidance; and campaign-level recipient-set audit semantics are now live.	1	1	2026-03-15 12:39:13.209678	2026-03-15 14:45:47.996
953b8170-1993-4f36-bc24-06599caf72fa	b6c2d9d5-3780-496f-b957-0a6b2da15da6	Owner Onboarding Form and Review Workflow	Repair onboarding clarity, field structure, review actions, and submission visibility.	2	0	2026-03-16 14:06:37.656191	2026-03-16 14:06:37.656191
38142c16-2f37-4915-a501-7488dc711ea7	b6c2d9d5-3780-496f-b957-0a6b2da15da6	Residential Registry and Data Integrity	Align people, owners, units, and occupancy with explicit validation and synchronization rules.	3	0	2026-03-16 14:06:37.660384	2026-03-16 14:06:37.660384
c001229d-45f6-4ca8-803f-ba16d7c0a5cc	b6c2d9d5-3780-496f-b957-0a6b2da15da6	Communications Architecture and Operator UX	Move misfiled finance functions, add templates and branding, and reduce communications workflow clutter.	4	0	2026-03-16 14:06:37.664039	2026-03-16 14:06:37.664039
425ab00f-24f7-4a79-b10f-d6b241eba756	9287c136-759b-432b-b82d-2ffa8d7ef695	Navigation, Wayfinding, and Workspace Context	Tighten shell-level orientation so users always know where they are, what association scope they are in, and how to jump to adjacent workflows quickly.	0	0	2026-03-15 13:23:08.235474	2026-03-15 14:47:31.229
980709db-e507-44bc-82f2-ef136cb2378e	8f6d2c2e-dc9c-4481-857e-e7bcbb195911	Resident Intake and Association Completeness	Resident intake and association completeness are delivered: unit-scoped owner and tenant links, token regeneration, occupancy-conditional owner intake, bundled multi-tenant capture, canonical occupancy derivation, domain-level completeness metrics, and remediation actions are now live in the onboarding workspace.	0	1	2026-03-15 12:39:13.183775	2026-03-15 14:50:15.118
3d11b1f0-048f-4d01-b1a8-5ae7510d2528	b6c2d9d5-3780-496f-b957-0a6b2da15da6	Governance Role and Permission Reliability	Fix board-role assignment, record-context placement, and governance permission evaluation.	5	0	2026-03-16 14:20:26.406895	2026-03-16 14:20:26.406895
0c78fc58-df34-48e9-9a0a-a95ee50bba03	b6c2d9d5-3780-496f-b957-0a6b2da15da6	Meetings, Agenda, Voting, and Compliance Operations	Repair meeting creation, agenda clarity, voting flows, governance task creation, and compliance-rule sync.	6	0	2026-03-16 14:20:26.416177	2026-03-16 14:20:26.416177
de0a72fe-a173-4333-b537-a949dc771dd4	b6c2d9d5-3780-496f-b957-0a6b2da15da6	Board Package Delivery and Operator Guidance	Clarify board package workflows, delivery behavior, and generation complexity.	7	0	2026-03-16 14:20:26.425674	2026-03-16 14:20:26.425674
77181305-2ac4-4fa6-8439-68f1183a064e	b6c2d9d5-3780-496f-b957-0a6b2da15da6	Platform Architecture and Feature Exposure Control	Align module relationships and hide unfinished features from non-admin users.	8	0	2026-03-16 14:20:26.435723	2026-03-16 14:20:26.435723
52e2ea28-5058-46f2-90fa-c403fc8f28ee	afd38fb0-c594-4b57-8151-397146ab973d	Financial Module	Close critical gaps in the payments workflow, delinquency management, financial reporting, and cross-module financial integration.	1	0	2026-03-17 01:44:01.632374	2026-03-17 01:44:01.632374
bffc2f86-4632-46fa-81f0-95d6307b8d86	afd38fb0-c594-4b57-8151-397146ab973d	Governance Module	Close workflow gaps in meetings, compliance, board packages, and board member management that currently require off-platform coordination.	2	0	2026-03-17 01:44:01.661942	2026-03-17 01:44:01.661942
3985ebd6-efea-41bb-8e77-fce83afdea1d	b6c2d9d5-3780-496f-b957-0a6b2da15da6	Authentication and Workspace Entry	Stabilize sign-in, post-auth redirect behavior, and public-entry UX residue.	0	1	2026-03-16 14:06:37.635112	2026-03-16 14:20:47.788
43266a06-9df9-42ac-8476-4be649b5b90f	afd38fb0-c594-4b57-8151-397146ab973d	Dashboard & Navigation	Improve the first-run experience, role-based navigation, and the dashboard's ability to surface actionable information rather than raw totals.	0	0	2026-03-17 01:44:01.609456	2026-03-17 01:44:01.609456
d45579a6-88c8-43eb-9bc0-515afa09a851	afd38fb0-c594-4b57-8151-397146ab973d	Operations Module	Improve work order management, vendor oversight, inspection workflows, and preventive maintenance to reduce reactive maintenance costs.	3	0	2026-03-17 01:44:01.827174	2026-03-17 01:44:01.827174
eda03077-4bd5-4bab-b034-c3c849f2aea7	afd38fb0-c594-4b57-8151-397146ab973d	Communications & Notifications	Integrate the communications module with all other product areas, add a template library, and build automated notification sequences for critical workflows.	4	0	2026-03-17 01:44:01.955316	2026-03-17 01:44:01.955316
1b77553b-18a3-4a71-a1ba-4df3ab634103	afd38fb0-c594-4b57-8151-397146ab973d	Owner Portal & Self-Service	Complete the owner-facing portal with payment, document access, maintenance request submission, and contact management — reducing inbound service calls for property managers.	5	0	2026-03-17 01:44:01.97782	2026-03-17 01:44:01.97782
d4f34e0b-9c2d-494e-a3e0-eaeb060a37b4	afd38fb0-c594-4b57-8151-397146ab973d	Data Integrity, Audit & Reporting	Address data quality gaps, add missing audit trails, and build reporting capabilities required for professional and legal compliance use cases.	6	0	2026-03-17 01:44:01.999347	2026-03-17 01:44:01.999347
06638de9-2a14-4269-b6d5-ce5747d3bf66	afd38fb0-c594-4b57-8151-397146ab973d	UX Polish & Accessibility	Address interaction design anti-patterns, dense forms, and missing confirmations that cause user errors or loss of confidence in the system.	7	0	2026-03-17 01:44:02.16651	2026-03-17 01:44:02.16651
\.


--
-- Data for Name: admin_users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.admin_users (id, email, role, is_active, created_at, updated_at) FROM stdin;
366b63b3-727f-405b-b561-2a1e5278b2ae	manager-pass2@local	manager	0	2026-03-07 22:00:51.12759	2026-03-12 21:19:53.322
183a4650-4cc7-4e5c-bbd3-4b708fb8b0d3	admin@local	platform-admin	1	2026-03-07 15:30:13.876659	2026-03-13 01:38:17.804
ae7a1d67-d01a-4041-ac39-68e1519ee77d	chcmgmt18@gmail.com	platform-admin	1	2026-03-14 14:48:30.305217	2026-03-16 16:04:32.767
b4d20095-aa16-42fa-97b3-99b688a6a323	yourcondomanagement@gmail.com	platform-admin	1	2026-03-12 21:19:53.314052	2026-03-16 17:37:24.711509
3121e4f5-e6c9-4660-b94c-c02879a4281e	williamruiz11@gmail.com	board-admin	1	2026-03-16 21:21:22.363	2026-03-16 21:21:22.363
\.


--
-- Data for Name: ai_extracted_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ai_extracted_records (id, job_id, association_id, record_type, payload_json, confidence_score, review_status, reviewed_by, reviewed_at, created_at, updated_at, superseded_at) FROM stdin;
5cc42246-0e49-4bdc-8e1f-7f7b8f1c47ca	71ce5e4b-83b8-4e28-b93b-55954932f466	f301d073-ed84-4d73-84ce-3ef28af66f7a	document-metadata	{"tags": ["review-required"], "title": "Uploaded Document", "snippet": "1415 Quinnipiac  Ave, New Haven, CT  06513\\t\\t\\t\\r\\n\\tUnit #\\tOwner(s)\\tPhone Number\\temail if available\\r\\n\\tA\\tNsofor Robinson \\t203-469-1363 or 203-980-1193\\trnsofor@yahoo.com\\r\\n\\tB\\tGloria Oritsejafor  \\t203-209-3642\\tgachigasim@gmail.com\\r\\n\\tC\\tJose Omar Sanchez \\t203-535-4821 \\tjoseomarsanchez77@gmail.com\\r\\n\\t\\t\\t\\t\\r\\n\\t1417 Quinnipiac  Ave, New Haven, CT  06513\\t\\t\\t\\r\\n\\tUnit #\\tOwner(s)\\tPhone Number\\temail if available\\r\\n\\tA\\tPete"}	0.68	rejected	admin@local	2026-03-07 21:20:03.982	2026-03-07 21:17:06.518985	2026-03-07 21:20:03.982	\N
d3ed6cbf-a56c-4b08-af9a-d52b4c4feb9f	e49dbc12-a37f-4dc4-8cea-dcd54abb78d3	f301d073-ed84-4d73-84ce-3ef28af66f7a	document-metadata	{"tags": ["review-required"], "title": "Uploaded Document", "snippet": "1415 Quinnipiac  Ave, New Haven, CT  06513\\t\\t\\t\\r\\n\\tUnit #\\tOwner(s)\\tPhone Number\\temail if available\\r\\n\\tA\\tNsofor Robinson \\t203-469-1363 or 203-980-1193\\trnsofor@yahoo.com\\r\\n\\tB\\tGloria Oritsejafor  \\t203-209-3642\\tgachigasim@gmail.com\\r\\n\\tC\\tJose Omar Sanchez \\t203-535-4821 \\tjoseomarsanchez77@gmail.com\\r\\n\\t\\t\\t\\t\\r\\n\\t1417 Quinnipiac  Ave, New Haven, CT  06513\\t\\t\\t\\r\\n\\tUnit #\\tOwner(s)\\tPhone Number\\temail if available\\r\\n\\tA\\tPete"}	0.68	pending-review	\N	\N	2026-03-07 21:32:40.377672	2026-03-07 21:32:40.376	\N
5454a541-13a2-4796-8d84-cd4cd50eb893	e49dbc12-a37f-4dc4-8cea-dcd54abb78d3	f301d073-ed84-4d73-84ce-3ef28af66f7a	document-metadata	{"tags": ["review-required"], "title": "Uploaded Document", "snippet": "1415 Quinnipiac  Ave, New Haven, CT  06513\\t\\t\\t\\r\\n\\tUnit #\\tOwner(s)\\tPhone Number\\temail if available\\r\\n\\tA\\tNsofor Robinson \\t203-469-1363 or 203-980-1193\\trnsofor@yahoo.com\\r\\n\\tB\\tGloria Oritsejafor  \\t203-209-3642\\tgachigasim@gmail.com\\r\\n\\tC\\tJose Omar Sanchez \\t203-535-4821 \\tjoseomarsanchez77@gmail.com\\r\\n\\t\\t\\t\\t\\r\\n\\t1417 Quinnipiac  Ave, New Haven, CT  06513\\t\\t\\t\\r\\n\\tUnit #\\tOwner(s)\\tPhone Number\\temail if available\\r\\n\\tA\\tPete"}	0.68	pending-review	\N	\N	2026-03-07 21:39:32.426253	2026-03-07 21:39:32.425	\N
48875598-fa9b-4706-8584-c4801259b2a3	71ce5e4b-83b8-4e28-b93b-55954932f466	f301d073-ed84-4d73-84ce-3ef28af66f7a	document-metadata	{"tags": ["review-required"], "title": "Uploaded Document", "snippet": "1415 Quinnipiac  Ave, New Haven, CT  06513\\t\\t\\t\\r\\n\\tUnit #\\tOwner(s)\\tPhone Number\\temail if available\\r\\n\\tA\\tNsofor Robinson \\t203-469-1363 or 203-980-1193\\trnsofor@yahoo.com\\r\\n\\tB\\tGloria Oritsejafor  \\t203-209-3642\\tgachigasim@gmail.com\\r\\n\\tC\\tJose Omar Sanchez \\t203-535-4821 \\tjoseomarsanchez77@gmail.com\\r\\n\\t\\t\\t\\t\\r\\n\\t1417 Quinnipiac  Ave, New Haven, CT  06513\\t\\t\\t\\r\\n\\tUnit #\\tOwner(s)\\tPhone Number\\temail if available\\r\\n\\tA\\tPete"}	0.68	approved	admin@local	2026-03-07 21:39:36.79	2026-03-07 21:39:33.552238	2026-03-07 21:39:36.79	\N
27fd80e6-dc98-4073-8943-44cf032b7819	1598dcce-45af-49b9-9c20-bc036032403a	\N	contact-roster	{"items": [{"email": "pat.jordan@example.com", "phone": "555-300-2222", "lastName": "Jordan", "firstName": "Pat", "mailingAddress": "300 Main St"}], "title": "Extracted Contact Roster", "itemCount": 1}	0.68	pending-review	\N	\N	2026-03-09 15:38:45.047766	2026-03-09 15:38:45.047	\N
519080da-cde2-456d-bec7-2ec223a99022	a28d88bb-e728-4db7-b68b-6795993dd05a	\N	contact-roster	{"items": [{"email": null, "phone": null, "lastName": "Electric", "firstName": "Vendor: Coastal", "mailingAddress": null}, {"email": null, "phone": null, "lastName": "INV-4021", "firstName": "Invoice #", "mailingAddress": null}, {"email": null, "phone": null, "lastName": "2025-01-10", "firstName": "Invoice Date:", "mailingAddress": null}, {"email": null, "phone": null, "lastName": "2025-01-24", "firstName": "Due Date:", "mailingAddress": null}, {"email": null, "phone": null, "lastName": "$842.35", "firstName": "Amount Due:", "mailingAddress": null}], "title": "Extracted Contact Roster", "itemCount": 5}	0.68	pending-review	\N	\N	2026-03-09 15:38:45.065008	2026-03-09 15:38:45.064	\N
bfa85b78-b94a-4ea9-9e8b-5edc134c17a6	4b2a38e1-fae6-43fc-a7c9-098127d61117	\N	contact-roster	{"items": [{"email": "pat.jordan@example.com", "phone": "555-300-2222", "lastName": "Jordan", "firstName": "Pat", "mailingAddress": "300 Main St"}], "title": "Extracted Contact Roster", "itemCount": 1}	0.68	pending-review	\N	\N	2026-03-09 15:39:33.216669	2026-03-09 15:39:33.216	\N
9d386680-72f9-443e-ab65-f13392fc7749	a28d88bb-e728-4db7-b68b-6795993dd05a	\N	document-metadata	{"title": "Classifier Routing Warning", "warning": "Classifier predicted invoice-draft but extractor did not emit that record type.", "classifier": {"rationale": "Predicted invoice-draft (75% confidence, threshold 60%).", "threshold": 0.6, "confidence": 0.75, "candidateTypes": [{"score": 6, "recordType": "invoice-draft"}, {"score": 1, "recordType": "document-metadata"}, {"score": 0, "recordType": "owner-roster"}, {"score": 0, "recordType": "contact-roster"}, {"score": 0, "recordType": "bank-statement"}, {"score": 0, "recordType": "meeting-notes"}], "predictedRecordType": "invoice-draft", "requiresManualReview": false}}	0.75	pending-review	\N	\N	2026-03-09 15:38:45.067673	2026-03-09 15:38:45.067	\N
16a9911d-0872-4e28-90ec-9f9617436885	1215a982-76b3-4d44-95d5-e4a1caaa833b	\N	contact-roster	{"items": [{"email": null, "phone": null, "lastName": "2025-01-31", "firstName": "Statement Period: 2025-01-01 to", "mailingAddress": null}, {"email": null, "phone": null, "lastName": "$-450.00", "firstName": "2025-01-12 Unit A-201 HOA payment", "mailingAddress": null}, {"email": null, "phone": null, "lastName": "$50.00", "firstName": "2025-01-15 Unit A-202 Late fee", "mailingAddress": null}], "title": "Extracted Contact Roster", "itemCount": 3}	0.68	pending-review	\N	\N	2026-03-09 15:38:45.083151	2026-03-09 15:38:45.082	\N
01b04f8e-670a-4d95-9066-64b31bb146b2	1215a982-76b3-4d44-95d5-e4a1caaa833b	\N	document-metadata	{"title": "Classifier Routing Warning", "warning": "Classifier predicted bank-statement but extractor did not emit that record type.", "classifier": {"rationale": "Predicted bank-statement (57% confidence, threshold 62%).", "threshold": 0.62, "confidence": 0.57, "candidateTypes": [{"score": 3, "recordType": "bank-statement"}, {"score": 2, "recordType": "owner-roster"}, {"score": 1, "recordType": "document-metadata"}, {"score": 0, "recordType": "contact-roster"}, {"score": 0, "recordType": "invoice-draft"}, {"score": 0, "recordType": "meeting-notes"}], "predictedRecordType": "bank-statement", "requiresManualReview": true}}	0.57	pending-review	\N	\N	2026-03-09 15:38:45.086128	2026-03-09 15:38:45.085	\N
806ca9fe-9f6a-406a-a7a3-e98e95d4c81b	1215a982-76b3-4d44-95d5-e4a1caaa833b	\N	document-metadata	{"title": "Manual Routing Required", "warning": "Classifier confidence is below threshold; review and route manually before commit.", "classifier": {"rationale": "Predicted bank-statement (57% confidence, threshold 62%).", "threshold": 0.62, "confidence": 0.57, "candidateTypes": [{"score": 3, "recordType": "bank-statement"}, {"score": 2, "recordType": "owner-roster"}, {"score": 1, "recordType": "document-metadata"}, {"score": 0, "recordType": "contact-roster"}, {"score": 0, "recordType": "invoice-draft"}, {"score": 0, "recordType": "meeting-notes"}], "predictedRecordType": "bank-statement", "requiresManualReview": true}}	0.57	pending-review	\N	\N	2026-03-09 15:38:45.088458	2026-03-09 15:38:45.088	\N
60925cd7-4e63-4a78-a574-4401eb417c9b	2043788a-0c76-4ae4-93ba-786dfebcc3d3	\N	contact-roster	{"items": [{"email": null, "phone": null, "lastName": "Minutes", "firstName": "Board Meeting", "mailingAddress": null}, {"email": null, "phone": null, "lastName": "study", "firstName": "Agenda: budget update and reserve", "mailingAddress": null}, {"email": null, "phone": null, "lastName": "draft", "firstName": "Resolution: approve 2026 budget", "mailingAddress": null}], "title": "Extracted Contact Roster", "itemCount": 3}	0.68	pending-review	\N	\N	2026-03-09 15:38:45.102091	2026-03-09 15:38:45.101	\N
addfa3d1-d603-4989-a896-73082a7961b9	2043788a-0c76-4ae4-93ba-786dfebcc3d3	\N	document-metadata	{"title": "Classifier Routing Warning", "warning": "Classifier predicted meeting-notes but extractor did not emit that record type.", "classifier": {"rationale": "Predicted meeting-notes (75% confidence, threshold 55%).", "threshold": 0.55, "confidence": 0.75, "candidateTypes": [{"score": 6, "recordType": "meeting-notes"}, {"score": 1, "recordType": "document-metadata"}, {"score": 0, "recordType": "owner-roster"}, {"score": 0, "recordType": "contact-roster"}, {"score": 0, "recordType": "invoice-draft"}, {"score": 0, "recordType": "bank-statement"}], "predictedRecordType": "meeting-notes", "requiresManualReview": false}}	0.75	pending-review	\N	\N	2026-03-09 15:38:45.104904	2026-03-09 15:38:45.104	\N
3dc1a299-d661-464e-b0e6-212e655cd2fe	a6a24f2d-d0ed-41e1-8169-f137c536e23d	\N	contact-roster	{"items": [{"email": "pat.jordan@example.com", "phone": "555-300-2222", "lastName": "Jordan", "firstName": "Pat", "mailingAddress": "300 Main St"}], "title": "Extracted Contact Roster", "itemCount": 1}	0.68	pending-review	\N	\N	2026-03-09 15:39:07.377766	2026-03-09 15:39:07.377	\N
27bad8c6-bec2-445d-9e71-222896bff70a	c7fd0854-5f07-4f08-aa88-2927bbbd7e84	\N	invoice-draft	{"amount": 402, "dueDate": null, "rawSnippet": "Vendor: Coastal Electric\\nInvoice # INV-4021\\nInvoice Date: 2025-01-10\\nDue Date: 2025-01-24\\nAmount Due: $842.35", "vendorName": "Vendor: Coastal Electric", "invoiceDate": "2025-01-10", "invoiceNumber": null}	0.68	pending-review	\N	\N	2026-03-09 15:39:07.393468	2026-03-09 15:39:07.392	\N
80fd13fa-3c2f-4a35-b1da-4db897721b7f	d9576d59-ad67-45b2-b5a4-82af58f1854e	\N	bank-statement	{"rawSnippet": "Statement Period: 2025-01-01 to 2025-01-31\\n2025-01-12 Unit A-201 HOA payment $-450.00\\n2025-01-15 Unit A-202 Late fee $50.00", "transactions": [], "statementPeriod": null, "transactionCountEstimate": 3}	0.68	pending-review	\N	\N	2026-03-09 15:39:07.408706	2026-03-09 15:39:07.408	\N
c23427bc-af63-47dd-9aac-8ecbe54937e6	d9576d59-ad67-45b2-b5a4-82af58f1854e	\N	document-metadata	{"title": "Manual Routing Required", "warning": "Classifier confidence is below threshold; review and route manually before commit.", "classifier": {"rationale": "Predicted bank-statement (57% confidence, threshold 62%).", "threshold": 0.62, "confidence": 0.57, "candidateTypes": [{"score": 3, "recordType": "bank-statement"}, {"score": 2, "recordType": "owner-roster"}, {"score": 1, "recordType": "document-metadata"}, {"score": 0, "recordType": "contact-roster"}, {"score": 0, "recordType": "invoice-draft"}, {"score": 0, "recordType": "meeting-notes"}], "predictedRecordType": "bank-statement", "requiresManualReview": true}}	0.57	pending-review	\N	\N	2026-03-09 15:39:07.411814	2026-03-09 15:39:07.411	\N
9380e4fc-2cb5-4f03-ba7c-b9cd67f65c18	cb85bb6c-f00e-45d7-8d72-e8d7ca657382	\N	meeting-notes	{"title": "Extracted Meeting Notes", "summary": "Board Meeting Minutes\\nAgenda: budget update and reserve study\\nResolution: approve 2026 budget draft", "suggestedMeetingType": "budget"}	0.68	pending-review	\N	\N	2026-03-09 15:39:07.427031	2026-03-09 15:39:07.426	\N
056e2315-66a6-469e-b708-602be6b80480	59e546b9-f45a-4be4-82e2-fdd00016bde1	\N	invoice-draft	{"amount": 402, "dueDate": null, "rawSnippet": "Vendor: Coastal Electric\\nInvoice # INV-4021\\nInvoice Date: 2025-01-10\\nDue Date: 2025-01-24\\nAmount Due: $842.35", "vendorName": "Vendor: Coastal Electric", "invoiceDate": "2025-01-10", "invoiceNumber": null}	0.68	pending-review	\N	\N	2026-03-09 15:39:33.232929	2026-03-09 15:39:33.232	\N
b208e01c-224d-4e3d-a091-7daf06cd63ad	5fdd35c7-4f10-4b8c-906f-9c555b51e2a3	\N	bank-statement	{"rawSnippet": "Statement Period: 2025-01-01 to 2025-01-31\\n2025-01-12 Unit A-201 HOA payment $-450.00\\n2025-01-15 Unit A-202 Late fee $50.00", "transactions": [], "statementPeriod": null, "transactionCountEstimate": 3}	0.68	pending-review	\N	\N	2026-03-09 15:39:33.266317	2026-03-09 15:39:33.265	\N
cc91a6f6-8dd8-48b8-af7d-a33116d7cdb1	5fdd35c7-4f10-4b8c-906f-9c555b51e2a3	\N	document-metadata	{"title": "Manual Routing Required", "warning": "Classifier confidence is below threshold; review and route manually before commit.", "classifier": {"rationale": "Predicted bank-statement (57% confidence, threshold 62%).", "threshold": 0.62, "confidence": 0.57, "candidateTypes": [{"score": 3, "recordType": "bank-statement"}, {"score": 2, "recordType": "owner-roster"}, {"score": 1, "recordType": "document-metadata"}, {"score": 0, "recordType": "contact-roster"}, {"score": 0, "recordType": "invoice-draft"}, {"score": 0, "recordType": "meeting-notes"}], "predictedRecordType": "bank-statement", "requiresManualReview": true}}	0.57	pending-review	\N	\N	2026-03-09 15:39:33.269493	2026-03-09 15:39:33.268	\N
344252d4-1eac-4bc9-9a99-7d4f54fb6f75	79a04089-c591-4e0c-8a52-1266355a7d83	\N	meeting-notes	{"title": "Extracted Meeting Notes", "summary": "Board Meeting Minutes\\nAgenda: budget update and reserve study\\nResolution: approve 2026 budget draft", "suggestedMeetingType": "budget"}	0.68	pending-review	\N	\N	2026-03-09 15:39:33.292257	2026-03-09 15:39:33.289	\N
f89cb26e-0859-45b2-8a4e-4b1785c36c3b	804f8959-d72e-45f6-96a9-d3b65ec4f25b	\N	bank-statement	{"rawSnippet": "Statement Period: 2025-01-01 to 2025-01-31\\n2025-01-12 Unit A-201 HOA payment $-450.00\\n2025-01-15 Unit A-202 Late fee $50.00", "transactions": [], "statementPeriod": null, "transactionCountEstimate": 3}	0.68	pending-review	\N	\N	2026-03-09 15:39:46.457694	2026-03-09 15:39:46.457	\N
22c20840-996d-42ca-bd85-c0e7a01eae68	804f8959-d72e-45f6-96a9-d3b65ec4f25b	\N	document-metadata	{"title": "Classifier Routing Warning", "warning": "Classifier predicted owner-roster but extractor did not emit that record type.", "classifier": {"rationale": "Predicted owner-roster (63% confidence, threshold 62%).", "threshold": 0.62, "confidence": 0.63, "candidateTypes": [{"score": 2, "recordType": "owner-roster"}, {"score": 1, "recordType": "bank-statement"}, {"score": 1, "recordType": "document-metadata"}, {"score": 0, "recordType": "contact-roster"}, {"score": 0, "recordType": "invoice-draft"}, {"score": 0, "recordType": "meeting-notes"}], "predictedRecordType": "owner-roster", "requiresManualReview": false}}	0.63	pending-review	\N	\N	2026-03-09 15:39:46.461809	2026-03-09 15:39:46.461	\N
6d3eabd0-71fc-48e3-a110-c8105dd0bcda	2464ec57-8426-4082-bf1a-0933305e7250	\N	contact-roster	{"items": [{"email": "pat.jordan@example.com", "phone": "555-300-2222", "lastName": "Jordan", "firstName": "Pat", "mailingAddress": "300 Main St"}], "title": "Extracted Contact Roster", "itemCount": 1}	0.68	pending-review	\N	\N	2026-03-09 15:40:31.125653	2026-03-09 15:40:31.125	\N
fddc878c-c0ee-4143-b815-77f306242eeb	0e10f687-b4ec-4dae-9e5b-369aa7124c85	\N	invoice-draft	{"notes": "Vendor: Coastal Electric Invoice # INV-4021 Invoice Date: 2025-01-10 Due Date: 2025-01-24 Amount Due: $842.35", "amount": 402, "status": null, "dueDate": "2025-01-24", "rawSnippet": "Vendor: Coastal Electric\\nInvoice # INV-4021\\nInvoice Date: 2025-01-10\\nDue Date: 2025-01-24\\nAmount Due: $842.35", "vendorName": "Vendor: Coastal Electric", "invoiceDate": "2025-01-10", "invoiceNumber": "INV-4021"}	0.68	pending-review	\N	\N	2026-03-09 15:40:31.146484	2026-03-09 15:40:31.146	\N
b7757b94-6cbe-4bd3-8d77-4787a2940c40	278af4fb-18be-431c-969e-ab11ded5042d	\N	bank-statement	{"rawSnippet": "Statement Period: 2025-01-01 to 2025-01-31\\n2025-01-12 Unit A-201 HOA payment $-450.00\\n2025-01-15 Unit A-202 Late fee $50.00", "transactions": [{"amount": -450, "postedAt": "2025-01-12", "entryType": "payment", "ownerName": null, "ownerEmail": null, "unitNumber": "A-201", "description": "2025-01-12 Unit A-201 HOA payment $-450.00"}, {"amount": 50, "postedAt": "2025-01-15", "entryType": "charge", "ownerName": null, "ownerEmail": null, "unitNumber": "A-202", "description": "2025-01-15 Unit A-202 Late fee $50.00"}], "statementPeriod": "2025-01-01 to 2025-01-31", "transactionCountEstimate": 3}	0.68	pending-review	\N	\N	2026-03-09 15:40:31.249604	2026-03-09 15:40:31.249	\N
454a4127-5eb5-45b4-82e0-97384fb13ede	278af4fb-18be-431c-969e-ab11ded5042d	\N	document-metadata	{"title": "Manual Routing Required", "warning": "Classifier confidence is below threshold; review and route manually before commit.", "classifier": {"rationale": "Predicted bank-statement (57% confidence, threshold 62%).", "threshold": 0.62, "confidence": 0.57, "candidateTypes": [{"score": 3, "recordType": "bank-statement"}, {"score": 2, "recordType": "owner-roster"}, {"score": 1, "recordType": "document-metadata"}, {"score": 0, "recordType": "contact-roster"}, {"score": 0, "recordType": "invoice-draft"}, {"score": 0, "recordType": "meeting-notes"}], "predictedRecordType": "bank-statement", "requiresManualReview": true}}	0.57	pending-review	\N	\N	2026-03-09 15:40:31.253009	2026-03-09 15:40:31.252	\N
938db1da-0e46-407e-9d2a-76869434c3d1	a31c0433-5d03-47de-a983-48a8f3e08117	\N	meeting-notes	{"title": "Extracted Meeting Notes", "summary": "Board Meeting Minutes\\nAgenda: budget update and reserve study\\nResolution: approve 2026 budget draft", "suggestedMeetingType": "budget"}	0.68	pending-review	\N	\N	2026-03-09 15:40:31.268035	2026-03-09 15:40:31.267	\N
cbd1b090-1d4f-484c-9e80-6999a2220233	7290ca6e-9651-4680-9218-7ee0bc0801d0	\N	contact-roster	{"items": [{"email": "pat.jordan@example.com", "phone": "555-300-2222", "lastName": "Jordan", "firstName": "Pat", "mailingAddress": "300 Main St"}], "title": "Extracted Contact Roster", "itemCount": 1}	0.68	pending-review	\N	\N	2026-03-09 15:49:37.135336	2026-03-09 15:49:37.134	\N
1479213d-2542-49b4-a044-7e026bf7edc1	14fee39e-39cb-4cca-8dd6-7b556939a048	\N	invoice-draft	{"notes": "Vendor: Coastal Electric Invoice # INV-4021 Invoice Date: 2025-01-10 Due Date: 2025-01-24 Amount Due: $842.35", "amount": 402, "status": null, "dueDate": "2025-01-24", "rawSnippet": "Vendor: Coastal Electric\\nInvoice # INV-4021\\nInvoice Date: 2025-01-10\\nDue Date: 2025-01-24\\nAmount Due: $842.35", "vendorName": "Vendor: Coastal Electric", "invoiceDate": "2025-01-10", "invoiceNumber": "INV-4021"}	0.68	pending-review	\N	\N	2026-03-09 15:49:37.162619	2026-03-09 15:49:37.162	\N
32364c1f-6aa1-4859-945f-d926448e1d56	e033b00b-4e7e-44d9-a411-d5213f7914f0	\N	bank-statement	{"rawSnippet": "Statement Period: 2025-01-01 to 2025-01-31\\n2025-01-12 Unit A-201 HOA payment $-450.00\\n2025-01-15 Unit A-202 Late fee $50.00", "transactions": [{"amount": -450, "postedAt": "2025-01-12", "entryType": "payment", "ownerName": null, "ownerEmail": null, "unitNumber": "A-201", "description": "2025-01-12 Unit A-201 HOA payment $-450.00"}, {"amount": 50, "postedAt": "2025-01-15", "entryType": "charge", "ownerName": null, "ownerEmail": null, "unitNumber": "A-202", "description": "2025-01-15 Unit A-202 Late fee $50.00"}], "statementPeriod": "2025-01-01 to 2025-01-31", "transactionCountEstimate": 3}	0.68	pending-review	\N	\N	2026-03-09 15:49:37.18574	2026-03-09 15:49:37.185	\N
c9afa5ea-a746-488d-a8d6-edc0cc8b3a65	e033b00b-4e7e-44d9-a411-d5213f7914f0	\N	document-metadata	{"title": "Manual Routing Required", "warning": "Classifier confidence is below threshold; review and route manually before commit.", "classifier": {"rationale": "Predicted bank-statement (57% confidence, threshold 62%).", "threshold": 0.62, "confidence": 0.57, "candidateTypes": [{"score": 3, "recordType": "bank-statement"}, {"score": 2, "recordType": "owner-roster"}, {"score": 1, "recordType": "document-metadata"}, {"score": 0, "recordType": "contact-roster"}, {"score": 0, "recordType": "invoice-draft"}, {"score": 0, "recordType": "meeting-notes"}], "predictedRecordType": "bank-statement", "requiresManualReview": true}}	0.57	pending-review	\N	\N	2026-03-09 15:49:37.190626	2026-03-09 15:49:37.189	\N
6832643d-ec73-49be-84ed-c48ced1ef4e3	ca717ff6-7717-46a0-88a5-8ed5c202cf93	\N	meeting-notes	{"title": "Extracted Meeting Notes", "summary": "Board Meeting Minutes\\nAgenda: budget update and reserve study\\nResolution: approve 2026 budget draft", "suggestedMeetingType": "budget"}	0.68	pending-review	\N	\N	2026-03-09 15:49:37.214836	2026-03-09 15:49:37.214	\N
a232a8fc-2bf4-4e26-871e-8adc038891ae	ae2bf699-baf5-4236-ab00-59287d1d190f	f301d073-ed84-4d73-84ce-3ef28af66f7a	owner-roster	{"items": [{"email": null, "phone": null, "lastName": "Ave", "firstName": "1415 Quinnipiac", "startDate": null, "unitNumber": "NEW", "mailingAddress": "CT  06513", "ownershipPercentage": null}, {"email": "rnsofor@yahoo.com", "phone": "203-469-1363", "lastName": "Unknown", "firstName": "A", "startDate": null, "unitNumber": "NSOFOR", "mailingAddress": null, "ownershipPercentage": null}, {"email": "gachigasim@gmail.com", "phone": "203-209-3642", "lastName": "Unknown", "firstName": "B", "startDate": null, "unitNumber": "GLORIA", "mailingAddress": null, "ownershipPercentage": null}, {"email": "joseomarsanchez77@gmail.com", "phone": "203-535-4821", "lastName": "Unknown", "firstName": "C", "startDate": null, "unitNumber": "JOSE", "mailingAddress": null, "ownershipPercentage": null}, {"email": null, "phone": null, "lastName": "Ave", "firstName": "1417 Quinnipiac", "startDate": null, "unitNumber": "NEW", "mailingAddress": "CT  06513", "ownershipPercentage": null}, {"email": "krissann.charles@gmail.com", "phone": "203-468-1288", "lastName": "Unknown", "firstName": "A", "startDate": null, "unitNumber": "PETER", "mailingAddress": null, "ownershipPercentage": null}, {"email": null, "phone": "484-636-6261", "lastName": "Unknown", "firstName": "B", "startDate": null, "unitNumber": "PRISCILLA", "mailingAddress": "`", "ownershipPercentage": null}, {"email": "minerva.miranda57@outlook.com", "phone": "203-804-9751", "lastName": "Unknown", "firstName": "C", "startDate": null, "unitNumber": "FELIPE", "mailingAddress": null, "ownershipPercentage": null}, {"email": "fanningcatherine@hotmail.com", "phone": "203-214-1944", "lastName": "Unknown", "firstName": "D", "startDate": null, "unitNumber": "CATHERINE", "mailingAddress": null, "ownershipPercentage": null}, {"email": "Fuquana.heyward@yahoo.com", "phone": "2035898864", "lastName": "Unknown", "firstName": "E", "startDate": null, "unitNumber": "MARY", "mailingAddress": null, "ownershipPercentage": null}, {"email": "williamruiz11@gmail.com", "phone": "203-676-4815", "lastName": "Unknown", "firstName": "F", "startDate": null, "unitNumber": "WILLIAM", "mailingAddress": null, "ownershipPercentage": null}, {"email": "dhtorok@comcast.net", "phone": "203-400-4943", "lastName": "Unknown", "firstName": "G", "startDate": null, "unitNumber": "DIANE", "mailingAddress": null, "ownershipPercentage": null}, {"email": null, "phone": null, "lastName": "Ave", "firstName": "1419 Quinnipiac", "startDate": null, "unitNumber": "NEW", "mailingAddress": "CT  06513", "ownershipPercentage": null}, {"email": "lestertillman@hotmail.com", "phone": "203-823-5557", "lastName": "Family", "firstName": "1", "startDate": null, "unitNumber": "TILLMAN", "mailingAddress": null, "ownershipPercentage": null}, {"email": null, "phone": null, "lastName": "Ave", "firstName": "1421 Quinnipiac", "startDate": null, "unitNumber": "NEW", "mailingAddress": "CT  06513", "ownershipPercentage": null}, {"email": "andrewsimpson96@yahoo.com", "phone": "203-901-6150", "lastName": "Unknown", "firstName": "A", "startDate": null, "unitNumber": "ANDREW", "mailingAddress": null, "ownershipPercentage": null}, {"email": "williamruiz11@gmail.com", "phone": "203-676-4815", "lastName": "Unknown", "firstName": "B", "startDate": null, "unitNumber": "WILLIAM", "mailingAddress": null, "ownershipPercentage": null}, {"email": "williamruiz11@gmail.com", "phone": "203-676-4815", "lastName": "Unknown", "firstName": "C", "startDate": null, "unitNumber": "WILLIAM", "mailingAddress": null, "ownershipPercentage": null}, {"email": "minerva.miranda57@outlook.com", "phone": "203-804-9751", "lastName": "Unknown", "firstName": "D", "startDate": null, "unitNumber": "FELIPE", "mailingAddress": null, "ownershipPercentage": null}, {"email": "thalia.pantoja@yale.edu", "phone": "203-506-8855", "lastName": "Unknown", "firstName": "E", "startDate": null, "unitNumber": "THALIA", "mailingAddress": null, "ownershipPercentage": null}, {"email": "lkmeals@gmail.com", "phone": "203-243-0632", "lastName": "Unknown", "firstName": "F", "startDate": null, "unitNumber": "LORRAINE", "mailingAddress": null, "ownershipPercentage": null}, {"email": "condorentals26@gmail.com", "phone": "516-250-9326", "lastName": "Unknown", "firstName": "G", "startDate": null, "unitNumber": "MAGEN", "mailingAddress": null, "ownershipPercentage": null}], "title": "Extracted Owner Roster", "itemCount": 22}	0.72	approved	admin@local	2026-03-09 16:04:54.601	2026-03-09 16:04:43.172303	2026-03-09 16:04:54.601	\N
a3d2b742-0f8d-47af-a67b-2180873b9d2f	ae2bf699-baf5-4236-ab00-59287d1d190f	f301d073-ed84-4d73-84ce-3ef28af66f7a	owner-roster	{"items": [{"email": null, "phone": null, "lastName": "Ave", "firstName": "1415 Quinnipiac", "startDate": null, "unitNumber": "NEW", "mailingAddress": "CT  06513", "ownershipPercentage": null}, {"email": "rnsofor@yahoo.com", "phone": "203-469-1363", "lastName": "Unknown", "firstName": "A", "startDate": null, "unitNumber": "NSOFOR", "mailingAddress": null, "ownershipPercentage": null}, {"email": "gachigasim@gmail.com", "phone": "203-209-3642", "lastName": "Unknown", "firstName": "B", "startDate": null, "unitNumber": "GLORIA", "mailingAddress": null, "ownershipPercentage": null}, {"email": "joseomarsanchez77@gmail.com", "phone": "203-535-4821", "lastName": "Unknown", "firstName": "C", "startDate": null, "unitNumber": "JOSE", "mailingAddress": null, "ownershipPercentage": null}, {"email": null, "phone": null, "lastName": "Ave", "firstName": "1417 Quinnipiac", "startDate": null, "unitNumber": "NEW", "mailingAddress": "CT  06513", "ownershipPercentage": null}, {"email": "krissann.charles@gmail.com", "phone": "203-468-1288", "lastName": "Unknown", "firstName": "A", "startDate": null, "unitNumber": "PETER", "mailingAddress": null, "ownershipPercentage": null}, {"email": null, "phone": "484-636-6261", "lastName": "Unknown", "firstName": "B", "startDate": null, "unitNumber": "PRISCILLA", "mailingAddress": "`", "ownershipPercentage": null}, {"email": "minerva.miranda57@outlook.com", "phone": "203-804-9751", "lastName": "Unknown", "firstName": "C", "startDate": null, "unitNumber": "FELIPE", "mailingAddress": null, "ownershipPercentage": null}, {"email": "fanningcatherine@hotmail.com", "phone": "203-214-1944", "lastName": "Unknown", "firstName": "D", "startDate": null, "unitNumber": "CATHERINE", "mailingAddress": null, "ownershipPercentage": null}, {"email": "Fuquana.heyward@yahoo.com", "phone": "2035898864", "lastName": "Unknown", "firstName": "E", "startDate": null, "unitNumber": "MARY", "mailingAddress": null, "ownershipPercentage": null}, {"email": "williamruiz11@gmail.com", "phone": "203-676-4815", "lastName": "Unknown", "firstName": "F", "startDate": null, "unitNumber": "WILLIAM", "mailingAddress": null, "ownershipPercentage": null}, {"email": "dhtorok@comcast.net", "phone": "203-400-4943", "lastName": "Unknown", "firstName": "G", "startDate": null, "unitNumber": "DIANE", "mailingAddress": null, "ownershipPercentage": null}, {"email": null, "phone": null, "lastName": "Ave", "firstName": "1419 Quinnipiac", "startDate": null, "unitNumber": "NEW", "mailingAddress": "CT  06513", "ownershipPercentage": null}, {"email": "lestertillman@hotmail.com", "phone": "203-823-5557", "lastName": "Family", "firstName": "1", "startDate": null, "unitNumber": "TILLMAN", "mailingAddress": null, "ownershipPercentage": null}, {"email": null, "phone": null, "lastName": "Ave", "firstName": "1421 Quinnipiac", "startDate": null, "unitNumber": "NEW", "mailingAddress": "CT  06513", "ownershipPercentage": null}, {"email": "andrewsimpson96@yahoo.com", "phone": "203-901-6150", "lastName": "Unknown", "firstName": "A", "startDate": null, "unitNumber": "ANDREW", "mailingAddress": null, "ownershipPercentage": null}, {"email": "williamruiz11@gmail.com", "phone": "203-676-4815", "lastName": "Unknown", "firstName": "B", "startDate": null, "unitNumber": "WILLIAM", "mailingAddress": null, "ownershipPercentage": null}, {"email": "williamruiz11@gmail.com", "phone": "203-676-4815", "lastName": "Unknown", "firstName": "C", "startDate": null, "unitNumber": "WILLIAM", "mailingAddress": null, "ownershipPercentage": null}, {"email": "minerva.miranda57@outlook.com", "phone": "203-804-9751", "lastName": "Unknown", "firstName": "D", "startDate": null, "unitNumber": "FELIPE", "mailingAddress": null, "ownershipPercentage": null}, {"email": "thalia.pantoja@yale.edu", "phone": "203-506-8855", "lastName": "Unknown", "firstName": "E", "startDate": null, "unitNumber": "THALIA", "mailingAddress": null, "ownershipPercentage": null}, {"email": "lkmeals@gmail.com", "phone": "203-243-0632", "lastName": "Unknown", "firstName": "F", "startDate": null, "unitNumber": "LORRAINE", "mailingAddress": null, "ownershipPercentage": null}, {"email": "condorentals26@gmail.com", "phone": "516-250-9326", "lastName": "Unknown", "firstName": "G", "startDate": null, "unitNumber": "MAGEN", "mailingAddress": null, "ownershipPercentage": null}], "title": "Extracted Owner Roster", "itemCount": 22}	0.72	pending-review	\N	\N	2026-03-09 16:05:18.046973	2026-03-09 16:05:18.046	\N
3b09904f-a075-4157-98f9-79bbac88f83a	6aa85aa5-b616-4b71-8797-d36fc1b30974	f301d073-ed84-4d73-84ce-3ef28af66f7a	owner-roster	{"items": [{"email": null, "phone": null, "lastName": "Ave", "firstName": "1415 Quinnipiac", "startDate": null, "unitNumber": "NEW", "mailingAddress": "CT  06513", "ownershipPercentage": null}, {"email": "rnsofor@yahoo.com", "phone": "203-469-1363", "lastName": "Unknown", "firstName": "A", "startDate": null, "unitNumber": "NSOFOR", "mailingAddress": null, "ownershipPercentage": null}, {"email": "gachigasim@gmail.com", "phone": "203-209-3642", "lastName": "Unknown", "firstName": "B", "startDate": null, "unitNumber": "GLORIA", "mailingAddress": null, "ownershipPercentage": null}, {"email": "joseomarsanchez77@gmail.com", "phone": "203-535-4821", "lastName": "Unknown", "firstName": "C", "startDate": null, "unitNumber": "JOSE", "mailingAddress": null, "ownershipPercentage": null}, {"email": null, "phone": null, "lastName": "Ave", "firstName": "1417 Quinnipiac", "startDate": null, "unitNumber": "NEW", "mailingAddress": "CT  06513", "ownershipPercentage": null}, {"email": "krissann.charles@gmail.com", "phone": "203-468-1288", "lastName": "Unknown", "firstName": "A", "startDate": null, "unitNumber": "PETER", "mailingAddress": null, "ownershipPercentage": null}, {"email": null, "phone": "484-636-6261", "lastName": "Unknown", "firstName": "B", "startDate": null, "unitNumber": "PRISCILLA", "mailingAddress": "`", "ownershipPercentage": null}, {"email": "minerva.miranda57@outlook.com", "phone": "203-804-9751", "lastName": "Unknown", "firstName": "C", "startDate": null, "unitNumber": "FELIPE", "mailingAddress": null, "ownershipPercentage": null}, {"email": "fanningcatherine@hotmail.com", "phone": "203-214-1944", "lastName": "Unknown", "firstName": "D", "startDate": null, "unitNumber": "CATHERINE", "mailingAddress": null, "ownershipPercentage": null}, {"email": "Fuquana.heyward@yahoo.com", "phone": "2035898864", "lastName": "Unknown", "firstName": "E", "startDate": null, "unitNumber": "MARY", "mailingAddress": null, "ownershipPercentage": null}, {"email": "williamruiz11@gmail.com", "phone": "203-676-4815", "lastName": "Unknown", "firstName": "F", "startDate": null, "unitNumber": "WILLIAM", "mailingAddress": null, "ownershipPercentage": null}, {"email": "dhtorok@comcast.net", "phone": "203-400-4943", "lastName": "Unknown", "firstName": "G", "startDate": null, "unitNumber": "DIANE", "mailingAddress": null, "ownershipPercentage": null}, {"email": null, "phone": null, "lastName": "Ave", "firstName": "1419 Quinnipiac", "startDate": null, "unitNumber": "NEW", "mailingAddress": "CT  06513", "ownershipPercentage": null}, {"email": "lestertillman@hotmail.com", "phone": "203-823-5557", "lastName": "Family", "firstName": "1", "startDate": null, "unitNumber": "TILLMAN", "mailingAddress": null, "ownershipPercentage": null}, {"email": null, "phone": null, "lastName": "Ave", "firstName": "1421 Quinnipiac", "startDate": null, "unitNumber": "NEW", "mailingAddress": "CT  06513", "ownershipPercentage": null}, {"email": "andrewsimpson96@yahoo.com", "phone": "203-901-6150", "lastName": "Unknown", "firstName": "A", "startDate": null, "unitNumber": "ANDREW", "mailingAddress": null, "ownershipPercentage": null}, {"email": "williamruiz11@gmail.com", "phone": "203-676-4815", "lastName": "Unknown", "firstName": "B", "startDate": null, "unitNumber": "WILLIAM", "mailingAddress": null, "ownershipPercentage": null}, {"email": "williamruiz11@gmail.com", "phone": "203-676-4815", "lastName": "Unknown", "firstName": "C", "startDate": null, "unitNumber": "WILLIAM", "mailingAddress": null, "ownershipPercentage": null}, {"email": "minerva.miranda57@outlook.com", "phone": "203-804-9751", "lastName": "Unknown", "firstName": "D", "startDate": null, "unitNumber": "FELIPE", "mailingAddress": null, "ownershipPercentage": null}, {"email": "thalia.pantoja@yale.edu", "phone": "203-506-8855", "lastName": "Unknown", "firstName": "E", "startDate": null, "unitNumber": "THALIA", "mailingAddress": null, "ownershipPercentage": null}, {"email": "lkmeals@gmail.com", "phone": "203-243-0632", "lastName": "Unknown", "firstName": "F", "startDate": null, "unitNumber": "LORRAINE", "mailingAddress": null, "ownershipPercentage": null}, {"email": "condorentals26@gmail.com", "phone": "516-250-9326", "lastName": "Unknown", "firstName": "G", "startDate": null, "unitNumber": "MAGEN", "mailingAddress": null, "ownershipPercentage": null}], "title": "Extracted Owner Roster", "itemCount": 22}	0.72	rejected	admin@local	2026-03-09 16:15:02.633	2026-03-09 16:14:56.615323	2026-03-09 16:15:02.633	\N
070a9715-b87e-4ec7-a014-acadef99f127	50607038-d5a7-4d78-b025-1442a6ab17cc	f301d073-ed84-4d73-84ce-3ef28af66f7a	owner-roster	{"items": [{"email": null, "phone": null, "lastName": "Ave", "firstName": "1415 Quinnipiac", "startDate": null, "unitNumber": "06513", "mailingAddress": "CT  06513", "ownershipPercentage": null}, {"email": null, "phone": null, "lastName": "Ave", "firstName": "1417 Quinnipiac", "startDate": null, "unitNumber": "06513", "mailingAddress": "CT  06513", "ownershipPercentage": null}, {"email": "dhtorok@comcast.net", "phone": "203-400-4943", "lastName": "Unknown", "firstName": "G", "startDate": null, "unitNumber": "VE", "mailingAddress": null, "ownershipPercentage": null}, {"email": null, "phone": null, "lastName": "Ave", "firstName": "1419 Quinnipiac", "startDate": null, "unitNumber": "06513", "mailingAddress": "CT  06513", "ownershipPercentage": null}, {"email": "lestertillman@hotmail.com", "phone": "203-823-5557", "lastName": "Family", "firstName": "1", "startDate": null, "unitNumber": "R", "mailingAddress": null, "ownershipPercentage": null}, {"email": null, "phone": null, "lastName": "Ave", "firstName": "1421 Quinnipiac", "startDate": null, "unitNumber": "06513", "mailingAddress": "CT  06513", "ownershipPercentage": null}], "title": "Extracted Owner Roster", "itemCount": 6, "_ingestionTrace": {"model": "gpt-4o-mini", "provider": "fallback", "fallbackReason": "AI extraction failed with status 400"}}	0.72	pending-review	\N	\N	2026-03-09 16:49:23.355592	2026-03-09 16:49:23.354	\N
caedb9d6-35fc-45a9-90cc-cf5d1d2d5270	1f542074-a1fc-4cf5-ac55-143efa924f5f	\N	bank-statement	{"rawSnippet": "Statement Period: 2025-01-01 to 2025-01-31\\n2025-01-12 Unit A-201 HOA payment $-450.00\\n2025-01-15 Unit A-202 Late fee $50.00", "transactions": [{"amount": -450, "postedAt": "2025-01-12", "entryType": "payment", "ownerName": null, "ownerEmail": null, "unitNumber": "A-201", "description": "2025-01-12 Unit A-201 HOA payment $-450.00"}, {"amount": 50, "postedAt": "2025-01-15", "entryType": "charge", "ownerName": null, "ownerEmail": null, "unitNumber": "A-202", "description": "2025-01-15 Unit A-202 Late fee $50.00"}], "_ingestionTrace": {"model": null, "provider": "fallback", "fallbackReason": "AI is not configured; using fallback extraction."}, "destinationPlan": {"routeReason": "Statement transactions route to owner-ledger entries after unit/person resolution.", "entityCounts": {"units": 0, "persons": 0, "exceptions": 0, "ownerships": 0, "contactPoints": 0, "vendorInvoices": 0, "ownerLedgerEntries": 2}, "primaryModule": "owner-ledger"}, "feedbackSignals": {"priorBankTransactionMappings": 0}, "statementPeriod": "2025-01-01 to 2025-01-31", "destinationModule": "owner-ledger", "transactionCountEstimate": 3}	0.7	pending-review	\N	\N	2026-03-09 19:45:31.24886	2026-03-09 19:45:31.247	\N
52b64cfc-1b47-4312-83e1-0cef79f9932c	1f542074-a1fc-4cf5-ac55-143efa924f5f	\N	document-metadata	{"title": "Manual Routing Required", "warning": "Classifier confidence is below threshold; review and route manually before commit.", "classifier": {"rationale": "Predicted bank-statement (57% confidence, threshold 62%).", "threshold": 0.62, "confidence": 0.57, "candidateTypes": [{"score": 3, "recordType": "bank-statement"}, {"score": 2, "recordType": "owner-roster"}, {"score": 1, "recordType": "document-metadata"}, {"score": 0, "recordType": "contact-roster"}, {"score": 0, "recordType": "invoice-draft"}, {"score": 0, "recordType": "meeting-notes"}], "predictedRecordType": "bank-statement", "requiresManualReview": true}, "_ingestionTrace": {"model": null, "provider": "fallback", "fallbackReason": "AI is not configured; using fallback extraction."}, "destinationPlan": {"routeReason": "Unclassified document routes to metadata/manual review.", "entityCounts": {"units": 0, "persons": 0, "exceptions": 0, "ownerships": 0, "contactPoints": 0, "vendorInvoices": 0, "ownerLedgerEntries": 0}, "primaryModule": "metadata"}, "destinationModule": "metadata"}	0.57	pending-review	\N	\N	2026-03-09 19:45:31.253563	2026-03-09 19:45:31.252	\N
bfa00845-ca09-4ae4-a88d-ec0c7667a3ed	d8356591-4c40-4668-a795-89daa80fe551	\N	contact-roster	{"items": [{"email": "pat.jordan@example.com", "phone": "555-300-2222", "lastName": "Jordan", "firstName": "Pat", "mailingAddress": "300 Main St"}, {"email": "avery.smith@example.com", "phone": "555-300-2223", "lastName": "Smith", "firstName": "Avery", "mailingAddress": "302 Main St"}], "title": "Extracted Contact Roster", "itemCount": 2, "_ingestionTrace": {"model": null, "provider": "fallback", "fallbackReason": "AI is not configured; using fallback extraction."}, "destinationPlan": {"routeReason": "Contact rows route to person/contact updates without ownership creation.", "entityCounts": {"units": 0, "persons": 2, "exceptions": 0, "ownerships": 0, "contactPoints": 2, "vendorInvoices": 0, "ownerLedgerEntries": 0}, "primaryModule": "persons"}, "destinationModule": "persons"}	0.68	pending-review	\N	\N	2026-03-09 19:45:31.281122	2026-03-09 19:45:31.28	\N
4a2bb05f-8934-4ef3-b41e-19ba6305c41c	4f15a24d-7125-48e5-830a-8dbabc7a6fa7	\N	invoice-draft	{"notes": "Vendor: Coastal Electric Invoice # INV-4021 Invoice Date: 2025-01-10 Due Date: 2025-01-24 Amount Due: $842.35", "amount": 402, "status": null, "dueDate": "2025-01-24", "rawSnippet": "Vendor: Coastal Electric\\nInvoice # INV-4021\\nInvoice Date: 2025-01-10\\nDue Date: 2025-01-24\\nAmount Due: $842.35", "vendorName": "Vendor: Coastal Electric", "invoiceDate": "2025-01-10", "invoiceNumber": "INV-4021", "_ingestionTrace": {"model": null, "provider": "fallback", "fallbackReason": "AI is not configured; using fallback extraction."}, "destinationPlan": {"routeReason": "Invoice facts route to vendor invoice creation or duplicate review.", "entityCounts": {"units": 0, "persons": 0, "exceptions": 0, "ownerships": 0, "contactPoints": 0, "vendorInvoices": 1, "ownerLedgerEntries": 0}, "primaryModule": "financial-invoices"}, "destinationModule": "financial-invoices"}	0.66	pending-review	\N	\N	2026-03-09 19:45:31.304922	2026-03-09 19:45:31.304	\N
6a8100d5-862a-4289-8cdd-d9d4f154dc45	7da95864-7920-4cb5-b2d3-a731a607cf9c	\N	meeting-notes	{"title": "Extracted Meeting Notes", "summary": "Board Meeting Minutes\\nAgenda: budget update and reserve study\\nResolution: approve 2026 budget draft", "_ingestionTrace": {"model": null, "provider": "fallback", "fallbackReason": "AI is not configured; using fallback extraction."}, "destinationPlan": {"routeReason": "Meeting notes route to governance review rather than direct import.", "entityCounts": {"units": 0, "persons": 0, "exceptions": 0, "ownerships": 0, "contactPoints": 0, "vendorInvoices": 0, "ownerLedgerEntries": 0}, "primaryModule": "governance"}, "destinationModule": "governance", "suggestedMeetingType": "budget"}	0.62	pending-review	\N	\N	2026-03-09 19:45:31.321936	2026-03-09 19:45:31.321	\N
a06f5469-94c0-4a45-b651-008991b6eeb7	e969fef6-d2ab-416c-a274-790072596dd2	\N	bank-statement	{"rawSnippet": "Statement Period: 2025-01-01 to 2025-01-31\\n2025-01-12 Unit A-201 HOA payment $-450.00\\n2025-01-15 Unit A-202 Late fee $50.00", "transactions": [{"amount": -450, "postedAt": "2025-01-12", "entryType": "payment", "ownerName": null, "ownerEmail": null, "unitNumber": "A-201", "description": "2025-01-12 Unit A-201 HOA payment $-450.00"}, {"amount": 50, "postedAt": "2025-01-15", "entryType": "charge", "ownerName": null, "ownerEmail": null, "unitNumber": "A-202", "description": "2025-01-15 Unit A-202 Late fee $50.00"}], "_ingestionTrace": {"model": null, "provider": "fallback", "fallbackReason": "AI is not configured; using fallback extraction."}, "destinationPlan": {"routeReason": "Statement transactions route to owner-ledger entries after unit/person resolution.", "entityCounts": {"units": 0, "persons": 0, "exceptions": 0, "ownerships": 0, "contactPoints": 0, "vendorInvoices": 0, "ownerLedgerEntries": 2}, "primaryModule": "owner-ledger"}, "feedbackSignals": {"priorBankTransactionMappings": 0}, "statementPeriod": "2025-01-01 to 2025-01-31", "destinationModule": "owner-ledger", "transactionCountEstimate": 3}	0.7	pending-review	\N	\N	2026-03-09 19:46:43.220017	2026-03-09 19:46:43.218	\N
5606c9df-113a-4f2b-8d65-58a475d8d850	e969fef6-d2ab-416c-a274-790072596dd2	\N	document-metadata	{"title": "Manual Routing Required", "warning": "Classifier confidence is below threshold; review and route manually before commit.", "classifier": {"rationale": "Predicted bank-statement (57% confidence, threshold 62%).", "threshold": 0.62, "confidence": 0.57, "candidateTypes": [{"score": 3, "recordType": "bank-statement"}, {"score": 2, "recordType": "owner-roster"}, {"score": 1, "recordType": "document-metadata"}, {"score": 0, "recordType": "contact-roster"}, {"score": 0, "recordType": "invoice-draft"}, {"score": 0, "recordType": "meeting-notes"}], "predictedRecordType": "bank-statement", "requiresManualReview": true}, "_ingestionTrace": {"model": null, "provider": "fallback", "fallbackReason": "AI is not configured; using fallback extraction."}, "destinationPlan": {"routeReason": "Unclassified document routes to metadata/manual review.", "entityCounts": {"units": 0, "persons": 0, "exceptions": 0, "ownerships": 0, "contactPoints": 0, "vendorInvoices": 0, "ownerLedgerEntries": 0}, "primaryModule": "metadata"}, "destinationModule": "metadata"}	0.57	pending-review	\N	\N	2026-03-09 19:46:43.225587	2026-03-09 19:46:43.224	\N
e6e78dcc-07be-490e-b173-c7b692e49a62	6276099f-83f2-471d-9024-78c3fd9bb111	\N	contact-roster	{"items": [{"email": "pat.jordan@example.com", "phone": "555-300-2222", "lastName": "Jordan", "firstName": "Pat", "mailingAddress": "300 Main St"}, {"email": "avery.smith@example.com", "phone": "555-300-2223", "lastName": "Smith", "firstName": "Avery", "mailingAddress": "302 Main St"}], "title": "Extracted Contact Roster", "itemCount": 2, "_ingestionTrace": {"model": null, "provider": "fallback", "fallbackReason": "AI is not configured; using fallback extraction."}, "destinationPlan": {"routeReason": "Contact rows route to person/contact updates without ownership creation.", "entityCounts": {"units": 0, "persons": 2, "exceptions": 0, "ownerships": 0, "contactPoints": 2, "vendorInvoices": 0, "ownerLedgerEntries": 0}, "primaryModule": "persons"}, "destinationModule": "persons"}	0.68	pending-review	\N	\N	2026-03-09 19:46:43.251053	2026-03-09 19:46:43.25	\N
8532de41-dec8-403f-aea5-1cb254fafe57	f74f1895-29fa-4a5c-95b1-84ada41b4f24	\N	invoice-draft	{"notes": "Vendor: Coastal Electric Invoice # INV-4021 Invoice Date: 2025-01-10 Due Date: 2025-01-24 Amount Due: $842.35", "amount": 402, "status": null, "dueDate": "2025-01-24", "rawSnippet": "Vendor: Coastal Electric\\nInvoice # INV-4021\\nInvoice Date: 2025-01-10\\nDue Date: 2025-01-24\\nAmount Due: $842.35", "vendorName": "Vendor: Coastal Electric", "invoiceDate": "2025-01-10", "invoiceNumber": "INV-4021", "_ingestionTrace": {"model": null, "provider": "fallback", "fallbackReason": "AI is not configured; using fallback extraction."}, "destinationPlan": {"routeReason": "Invoice facts route to vendor invoice creation or duplicate review.", "entityCounts": {"units": 0, "persons": 0, "exceptions": 0, "ownerships": 0, "contactPoints": 0, "vendorInvoices": 1, "ownerLedgerEntries": 0}, "primaryModule": "financial-invoices"}, "destinationModule": "financial-invoices"}	0.66	pending-review	\N	\N	2026-03-09 19:46:43.28276	2026-03-09 19:46:43.282	\N
fd1f9e27-47f5-4796-b7c6-cae2aaa3c53e	1fa09545-fa3c-4771-a142-59f6551176e5	\N	meeting-notes	{"title": "Extracted Meeting Notes", "summary": "Board Meeting Minutes\\nAgenda: budget update and reserve study\\nResolution: approve 2026 budget draft", "_ingestionTrace": {"model": null, "provider": "fallback", "fallbackReason": "AI is not configured; using fallback extraction."}, "destinationPlan": {"routeReason": "Meeting notes route to governance review rather than direct import.", "entityCounts": {"units": 0, "persons": 0, "exceptions": 0, "ownerships": 0, "contactPoints": 0, "vendorInvoices": 0, "ownerLedgerEntries": 0}, "primaryModule": "governance"}, "destinationModule": "governance", "suggestedMeetingType": "budget"}	0.62	pending-review	\N	\N	2026-03-09 19:46:43.309332	2026-03-09 19:46:43.308	\N
\.


--
-- Data for Name: ai_ingestion_import_runs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ai_ingestion_import_runs (id, ingestion_job_id, extracted_record_id, association_id, mode, target_module, run_status, summary_json, created_entity_refs_json, actor_email, error_message, rolled_back_at, created_at, updated_at) FROM stdin;
cfa14bf4-7785-4cd7-a387-78d98b011fa9	50607038-d5a7-4d78-b025-1442a6ab17cc	070a9715-b87e-4ec7-a014-acadef99f127	f301d073-ed84-4d73-84ce-3ef28af66f7a	preview	owners	preview-success	{"dryRun": true, "details": [{"action": "skip", "module": "owners", "reason": "Unit creation required in commit mode; preview cannot provide unit id.", "entityKey": "06513:1415 Quinnipiac Ave"}, {"action": "skip", "module": "owners", "reason": "Unit creation required in commit mode; preview cannot provide unit id.", "entityKey": "06513:1417 Quinnipiac Ave"}, {"action": "skip", "module": "owners", "reason": "Unit creation required in commit mode; preview cannot provide unit id.", "entityKey": "VE:G Unknown"}, {"action": "skip", "module": "owners", "reason": "Unit creation required in commit mode; preview cannot provide unit id.", "entityKey": "06513:1419 Quinnipiac Ave"}, {"action": "skip", "module": "owners", "reason": "Unit creation required in commit mode; preview cannot provide unit id.", "entityKey": "R:1 Family"}, {"action": "skip", "module": "owners", "reason": "Unit creation required in commit mode; preview cannot provide unit id.", "entityKey": "06513:1421 Quinnipiac Ave"}], "message": "Preview complete: 0 ownerships, 0 people, 6 units would be created.", "imported": true, "skippedRows": 6, "sourceJobId": "50607038-d5a7-4d78-b025-1442a6ab17cc", "createdUnits": 6, "targetModule": "owners", "createdPersons": 0, "sourceRecordId": "070a9715-b87e-4ec7-a014-acadef99f127", "updatedPersons": 0, "sourceRecordType": "owner-roster", "createdOwnerships": 0, "createdVendorInvoices": 0, "createdVendorInvoiceIds": [], "createdOwnerLedgerEntries": 0, "createdOwnerLedgerEntryIds": []}	{"vendorInvoiceIds": [], "ownerLedgerEntryIds": []}	admin@local	\N	\N	2026-03-09 16:49:48.430668	2026-03-09 16:49:48.43
\.


--
-- Data for Name: ai_ingestion_jobs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ai_ingestion_jobs (id, association_id, source_type, source_filename, source_text, source_file_url, status, submitted_by, started_at, completed_at, error_message, created_at, updated_at, context_notes, source_document_id) FROM stdin;
71ce5e4b-83b8-4e28-b93b-55954932f466	f301d073-ed84-4d73-84ce-3ef28af66f7a	pasted-text	\N	1415 Quinnipiac  Ave, New Haven, CT  06513\t\t\t\r\n\tUnit #\tOwner(s)\tPhone Number\temail if available\r\n\tA\tNsofor Robinson \t203-469-1363 or 203-980-1193\trnsofor@yahoo.com\r\n\tB\tGloria Oritsejafor  \t203-209-3642\tgachigasim@gmail.com\r\n\tC\tJose Omar Sanchez \t203-535-4821 \tjoseomarsanchez77@gmail.com\r\n\t\t\t\t\r\n\t1417 Quinnipiac  Ave, New Haven, CT  06513\t\t\t\r\n\tUnit #\tOwner(s)\tPhone Number\temail if available\r\n\tA\tPeter & Rita Charles \t203-468-1288\tkrissann.charles@gmail.com\r\n\tB\tPriscilla Ruiz and Luz Miranda \t484-636-6261\t`\r\n\tC\tFelipe Pantoja\t203-804-9751\tminerva.miranda57@outlook.com  and pantojaf2001@hotmail.com\r\n\tD\tCatherine Fanning \t203-214-1944\tfanningcatherine@hotmail.com\r\n\tE\tMary F. Heyward (POW: Fuquana Heyward, niece)\t2035898864\tFuquana.heyward@yahoo.com\r\n\tF\tWilliam Ruiz\t203-676-4815\twilliamruiz11@gmail.com\r\n\tG\tDiane and Steve Torok - new owners\t203-400-4943 (cell)\tdhtorok@comcast.net\r\n\t\t\t\t\r\n\t1419 Quinnipiac Ave, New Haven, CT  06513\t\t\t\r\n\tUnit #\tOwner(s)\tPhone Number\temail if available\r\n\t1 Family\tTillman Lester AKA Lester J Jr\t203-823-5557\tlestertillman@hotmail.com\r\n\t\t\t\t\r\n\t\t\t\t\r\n\t1421 Quinnipiac Ave, New Haven, CT  06513\t\t\t\r\n\tUnit #\tOwner(s)\tPhone Number\temail if available\r\n\tA\tAndrew Simpson \t203-901-6150 (son) \tandrewsimpson96@yahoo.com\r\n\tB\tWilliam Ruiz \t203-676-4815\twilliamruiz11@gmail.com\r\n\tC\tWilliam Ruiz \t203-676-4815\twilliamruiz11@gmail.com\r\n\tD\tFelipe Pantoja  \t203-804-9751\tminerva.miranda57@outlook.com  and pantojaf2001@hotmail.com\r\n\tE\tThalia I Pantoja\t203-506-8855\tthalia.pantoja@yale.edu\r\n\tF\tLorraine Santiago\t203-243-0632\tlkmeals@gmail.com\r\n\tG\tMagen LLC  : Owner Allen  \t516-250-9326\tcondorentals26@gmail.com	\N	completed	admin@local	2026-03-07 21:39:33.548	2026-03-07 21:39:33.555	\N	2026-03-07 21:17:02.069727	2026-03-07 21:39:33.555	\N	\N
e49dbc12-a37f-4dc4-8cea-dcd54abb78d3	f301d073-ed84-4d73-84ce-3ef28af66f7a	pasted-text	\N	1415 Quinnipiac  Ave, New Haven, CT  06513\t\t\t\r\n\tUnit #\tOwner(s)\tPhone Number\temail if available\r\n\tA\tNsofor Robinson \t203-469-1363 or 203-980-1193\trnsofor@yahoo.com\r\n\tB\tGloria Oritsejafor  \t203-209-3642\tgachigasim@gmail.com\r\n\tC\tJose Omar Sanchez \t203-535-4821 \tjoseomarsanchez77@gmail.com\r\n\t\t\t\t\r\n\t1417 Quinnipiac  Ave, New Haven, CT  06513\t\t\t\r\n\tUnit #\tOwner(s)\tPhone Number\temail if available\r\n\tA\tPeter & Rita Charles \t203-468-1288\tkrissann.charles@gmail.com\r\n\tB\tPriscilla Ruiz and Luz Miranda \t484-636-6261\t`\r\n\tC\tFelipe Pantoja\t203-804-9751\tminerva.miranda57@outlook.com  and pantojaf2001@hotmail.com\r\n\tD\tCatherine Fanning \t203-214-1944\tfanningcatherine@hotmail.com\r\n\tE\tMary F. Heyward (POW: Fuquana Heyward, niece)\t2035898864\tFuquana.heyward@yahoo.com\r\n\tF\tWilliam Ruiz\t203-676-4815\twilliamruiz11@gmail.com\r\n\tG\tDiane and Steve Torok - new owners\t203-400-4943 (cell)\tdhtorok@comcast.net\r\n\t\t\t\t\r\n\t1419 Quinnipiac Ave, New Haven, CT  06513\t\t\t\r\n\tUnit #\tOwner(s)\tPhone Number\temail if available\r\n\t1 Family\tTillman Lester AKA Lester J Jr\t203-823-5557\tlestertillman@hotmail.com\r\n\t\t\t\t\r\n\t\t\t\t\r\n\t1421 Quinnipiac Ave, New Haven, CT  06513\t\t\t\r\n\tUnit #\tOwner(s)\tPhone Number\temail if available\r\n\tA\tAndrew Simpson \t203-901-6150 (son) \tandrewsimpson96@yahoo.com\r\n\tB\tWilliam Ruiz \t203-676-4815\twilliamruiz11@gmail.com\r\n\tC\tWilliam Ruiz \t203-676-4815\twilliamruiz11@gmail.com\r\n\tD\tFelipe Pantoja  \t203-804-9751\tminerva.miranda57@outlook.com  and pantojaf2001@hotmail.com\r\n\tE\tThalia I Pantoja\t203-506-8855\tthalia.pantoja@yale.edu\r\n\tF\tLorraine Santiago\t203-243-0632\tlkmeals@gmail.com\r\n\tG\tMagen LLC  : Owner Allen  \t516-250-9326\tcondorentals26@gmail.com	\N	completed	admin@local	2026-03-07 21:39:32.392	2026-03-07 21:39:32.429	\N	2026-03-07 21:32:12.279253	2026-03-07 21:39:32.429	\N	\N
1598dcce-45af-49b9-9c20-bc036032403a	\N	pasted-text	contact-roster.txt	Name,Email,Phone,Mailing Address\nPat Jordan,pat.jordan@example.com,555-300-2222,300 Main St	\N	completed	benchmark@local	2026-03-09 15:38:45.041	2026-03-09 15:38:45.05	\N	2026-03-09 15:38:45.038498	2026-03-09 15:38:45.05	benchmark:contact-roster	\N
a28d88bb-e728-4db7-b68b-6795993dd05a	\N	pasted-text	invoice-draft.txt	Vendor: Coastal Electric\nInvoice # INV-4021\nInvoice Date: 2025-01-10\nDue Date: 2025-01-24\nAmount Due: $842.35	\N	completed	benchmark@local	2026-03-09 15:38:45.059	2026-03-09 15:38:45.07	\N	2026-03-09 15:38:45.055655	2026-03-09 15:38:45.07	benchmark:invoice-draft	\N
1215a982-76b3-4d44-95d5-e4a1caaa833b	\N	pasted-text	bank-statement.txt	Statement Period: 2025-01-01 to 2025-01-31\n2025-01-12 Unit A-201 HOA payment $-450.00\n2025-01-15 Unit A-202 Late fee $50.00	\N	completed	benchmark@local	2026-03-09 15:38:45.076	2026-03-09 15:38:45.09	\N	2026-03-09 15:38:45.073884	2026-03-09 15:38:45.09	benchmark:bank-statement	\N
2043788a-0c76-4ae4-93ba-786dfebcc3d3	\N	pasted-text	meeting-notes.txt	Board Meeting Minutes\nAgenda: budget update and reserve study\nResolution: approve 2026 budget draft	\N	completed	benchmark@local	2026-03-09 15:38:45.097	2026-03-09 15:38:45.106	\N	2026-03-09 15:38:45.094453	2026-03-09 15:38:45.106	benchmark:meeting-notes	\N
4b2a38e1-fae6-43fc-a7c9-098127d61117	\N	pasted-text	contact-roster.txt	Name,Email,Phone,Mailing Address\nPat Jordan,pat.jordan@example.com,555-300-2222,300 Main St	\N	completed	benchmark@local	2026-03-09 15:39:33.21	2026-03-09 15:39:33.219	\N	2026-03-09 15:39:33.206729	2026-03-09 15:39:33.219	benchmark:contact-roster	\N
a6a24f2d-d0ed-41e1-8169-f137c536e23d	\N	pasted-text	contact-roster.txt	Name,Email,Phone,Mailing Address\nPat Jordan,pat.jordan@example.com,555-300-2222,300 Main St	\N	completed	benchmark@local	2026-03-09 15:39:07.372	2026-03-09 15:39:07.38	\N	2026-03-09 15:39:07.368658	2026-03-09 15:39:07.38	benchmark:contact-roster	\N
c7fd0854-5f07-4f08-aa88-2927bbbd7e84	\N	pasted-text	invoice-draft.txt	Vendor: Coastal Electric\nInvoice # INV-4021\nInvoice Date: 2025-01-10\nDue Date: 2025-01-24\nAmount Due: $842.35	\N	completed	benchmark@local	2026-03-09 15:39:07.387	2026-03-09 15:39:07.395	\N	2026-03-09 15:39:07.384738	2026-03-09 15:39:07.395	benchmark:invoice-draft	\N
d9576d59-ad67-45b2-b5a4-82af58f1854e	\N	pasted-text	bank-statement.txt	Statement Period: 2025-01-01 to 2025-01-31\n2025-01-12 Unit A-201 HOA payment $-450.00\n2025-01-15 Unit A-202 Late fee $50.00	\N	completed	benchmark@local	2026-03-09 15:39:07.402	2026-03-09 15:39:07.414	\N	2026-03-09 15:39:07.399583	2026-03-09 15:39:07.414	benchmark:bank-statement	\N
59e546b9-f45a-4be4-82e2-fdd00016bde1	\N	pasted-text	invoice-draft.txt	Vendor: Coastal Electric\nInvoice # INV-4021\nInvoice Date: 2025-01-10\nDue Date: 2025-01-24\nAmount Due: $842.35	\N	completed	benchmark@local	2026-03-09 15:39:33.227	2026-03-09 15:39:33.237	\N	2026-03-09 15:39:33.224376	2026-03-09 15:39:33.237	benchmark:invoice-draft	\N
cb85bb6c-f00e-45d7-8d72-e8d7ca657382	\N	pasted-text	meeting-notes.txt	Board Meeting Minutes\nAgenda: budget update and reserve study\nResolution: approve 2026 budget draft	\N	completed	benchmark@local	2026-03-09 15:39:07.422	2026-03-09 15:39:07.448	\N	2026-03-09 15:39:07.418639	2026-03-09 15:39:07.448	benchmark:meeting-notes	\N
5fdd35c7-4f10-4b8c-906f-9c555b51e2a3	\N	pasted-text	bank-statement.txt	Statement Period: 2025-01-01 to 2025-01-31\n2025-01-12 Unit A-201 HOA payment $-450.00\n2025-01-15 Unit A-202 Late fee $50.00	\N	completed	benchmark@local	2026-03-09 15:39:33.26	2026-03-09 15:39:33.272	\N	2026-03-09 15:39:33.24205	2026-03-09 15:39:33.272	benchmark:bank-statement	\N
0e10f687-b4ec-4dae-9e5b-369aa7124c85	\N	pasted-text	invoice-draft.txt	Vendor: Coastal Electric\nInvoice # INV-4021\nInvoice Date: 2025-01-10\nDue Date: 2025-01-24\nAmount Due: $842.35	\N	completed	benchmark@local	2026-03-09 15:40:31.14	2026-03-09 15:40:31.23	\N	2026-03-09 15:40:31.134277	2026-03-09 15:40:31.23	benchmark:invoice-draft	\N
79a04089-c591-4e0c-8a52-1266355a7d83	\N	pasted-text	meeting-notes.txt	Board Meeting Minutes\nAgenda: budget update and reserve study\nResolution: approve 2026 budget draft	\N	completed	benchmark@local	2026-03-09 15:39:33.283	2026-03-09 15:39:33.308	\N	2026-03-09 15:39:33.280044	2026-03-09 15:39:33.308	benchmark:meeting-notes	\N
804f8959-d72e-45f6-96a9-d3b65ec4f25b	\N	pasted-text	bank.txt	Statement Period: 2025-01-01 to 2025-01-31\n2025-01-12 Unit A-201 HOA payment $-450.00\n2025-01-15 Unit A-202 Late fee $50.00	\N	completed	dbg@local	2026-03-09 15:39:46.448	2026-03-09 15:39:46.464	\N	2026-03-09 15:39:46.441607	2026-03-09 15:39:46.464	benchmark:bank	\N
2464ec57-8426-4082-bf1a-0933305e7250	\N	pasted-text	contact-roster.txt	Name,Email,Phone,Mailing Address\nPat Jordan,pat.jordan@example.com,555-300-2222,300 Main St	\N	completed	benchmark@local	2026-03-09 15:40:31.117	2026-03-09 15:40:31.128	\N	2026-03-09 15:40:31.111924	2026-03-09 15:40:31.128	benchmark:contact-roster	\N
a31c0433-5d03-47de-a983-48a8f3e08117	\N	pasted-text	meeting-notes.txt	Board Meeting Minutes\nAgenda: budget update and reserve study\nResolution: approve 2026 budget draft	\N	completed	benchmark@local	2026-03-09 15:40:31.263	2026-03-09 15:40:31.282	\N	2026-03-09 15:40:31.259802	2026-03-09 15:40:31.282	benchmark:meeting-notes	\N
278af4fb-18be-431c-969e-ab11ded5042d	\N	pasted-text	bank-statement.txt	Statement Period: 2025-01-01 to 2025-01-31\n2025-01-12 Unit A-201 HOA payment $-450.00\n2025-01-15 Unit A-202 Late fee $50.00	\N	completed	benchmark@local	2026-03-09 15:40:31.243	2026-03-09 15:40:31.255	\N	2026-03-09 15:40:31.237359	2026-03-09 15:40:31.255	benchmark:bank-statement	\N
7290ca6e-9651-4680-9218-7ee0bc0801d0	\N	pasted-text	contact-roster.txt	Name,Email,Phone,Mailing Address\nPat Jordan,pat.jordan@example.com,555-300-2222,300 Main St	\N	completed	benchmark@local	2026-03-09 15:49:37.127	2026-03-09 15:49:37.139	\N	2026-03-09 15:49:37.1227	2026-03-09 15:49:37.139	benchmark:contact-roster	\N
14fee39e-39cb-4cca-8dd6-7b556939a048	\N	pasted-text	invoice-draft.txt	Vendor: Coastal Electric\nInvoice # INV-4021\nInvoice Date: 2025-01-10\nDue Date: 2025-01-24\nAmount Due: $842.35	\N	completed	benchmark@local	2026-03-09 15:49:37.149	2026-03-09 15:49:37.166	\N	2026-03-09 15:49:37.145604	2026-03-09 15:49:37.166	benchmark:invoice-draft	\N
e033b00b-4e7e-44d9-a411-d5213f7914f0	\N	pasted-text	bank-statement.txt	Statement Period: 2025-01-01 to 2025-01-31\n2025-01-12 Unit A-201 HOA payment $-450.00\n2025-01-15 Unit A-202 Late fee $50.00	\N	completed	benchmark@local	2026-03-09 15:49:37.175	2026-03-09 15:49:37.194	\N	2026-03-09 15:49:37.172122	2026-03-09 15:49:37.194	benchmark:bank-statement	\N
ae2bf699-baf5-4236-ab00-59287d1d190f	f301d073-ed84-4d73-84ce-3ef28af66f7a	pasted-text	\N	1415 Quinnipiac  Ave, New Haven, CT  06513\t\t\t\r\n\tUnit #\tOwner(s)\tPhone Number\temail if available\r\n\tA\tNsofor Robinson \t203-469-1363 or 203-980-1193\trnsofor@yahoo.com\r\n\tB\tGloria Oritsejafor  \t203-209-3642\tgachigasim@gmail.com\r\n\tC\tJose Omar Sanchez \t203-535-4821 \tjoseomarsanchez77@gmail.com\r\n\t\t\t\t\r\n\t1417 Quinnipiac  Ave, New Haven, CT  06513\t\t\t\r\n\tUnit #\tOwner(s)\tPhone Number\temail if available\r\n\tA\tPeter & Rita Charles \t203-468-1288\tkrissann.charles@gmail.com\r\n\tB\tPriscilla Ruiz and Luz Miranda \t484-636-6261\t`\r\n\tC\tFelipe Pantoja\t203-804-9751\tminerva.miranda57@outlook.com  and pantojaf2001@hotmail.com\r\n\tD\tCatherine Fanning \t203-214-1944\tfanningcatherine@hotmail.com\r\n\tE\tMary F. Heyward (POW: Fuquana Heyward, niece)\t2035898864\tFuquana.heyward@yahoo.com\r\n\tF\tWilliam Ruiz\t203-676-4815\twilliamruiz11@gmail.com\r\n\tG\tDiane and Steve Torok - new owners\t203-400-4943 (cell)\tdhtorok@comcast.net\r\n\t\t\t\t\r\n\t1419 Quinnipiac Ave, New Haven, CT  06513\t\t\t\r\n\tUnit #\tOwner(s)\tPhone Number\temail if available\r\n\t1 Family\tTillman Lester AKA Lester J Jr\t203-823-5557\tlestertillman@hotmail.com\r\n\t\t\t\t\r\n\t\t\t\t\r\n\t1421 Quinnipiac Ave, New Haven, CT  06513\t\t\t\r\n\tUnit #\tOwner(s)\tPhone Number\temail if available\r\n\tA\tAndrew Simpson \t203-901-6150 (son) \tandrewsimpson96@yahoo.com\r\n\tB\tWilliam Ruiz \t203-676-4815\twilliamruiz11@gmail.com\r\n\tC\tWilliam Ruiz \t203-676-4815\twilliamruiz11@gmail.com\r\n\tD\tFelipe Pantoja  \t203-804-9751\tminerva.miranda57@outlook.com  and pantojaf2001@hotmail.com\r\n\tE\tThalia I Pantoja\t203-506-8855\tthalia.pantoja@yale.edu\r\n\tF\tLorraine Santiago\t203-243-0632\tlkmeals@gmail.com\r\n\tG\tMagen LLC  : Owner Allen  \t516-250-9326\tcondorentals26@gmail.com	\N	completed	admin@local	2026-03-09 16:05:17.263	2026-03-09 16:05:18.051	\N	2026-03-09 16:04:34.503723	2026-03-09 16:05:18.051	\N	\N
ca717ff6-7717-46a0-88a5-8ed5c202cf93	\N	pasted-text	meeting-notes.txt	Board Meeting Minutes\nAgenda: budget update and reserve study\nResolution: approve 2026 budget draft	\N	completed	benchmark@local	2026-03-09 15:49:37.206	2026-03-09 15:49:37.236	\N	2026-03-09 15:49:37.200189	2026-03-09 15:49:37.236	benchmark:meeting-notes	\N
6aa85aa5-b616-4b71-8797-d36fc1b30974	f301d073-ed84-4d73-84ce-3ef28af66f7a	pasted-text	\N	1415 Quinnipiac  Ave, New Haven, CT  06513\t\t\t\r\n\tUnit #\tOwner(s)\tPhone Number\temail if available\r\n\tA\tNsofor Robinson \t203-469-1363 or 203-980-1193\trnsofor@yahoo.com\r\n\tB\tGloria Oritsejafor  \t203-209-3642\tgachigasim@gmail.com\r\n\tC\tJose Omar Sanchez \t203-535-4821 \tjoseomarsanchez77@gmail.com\r\n\t\t\t\t\r\n\t1417 Quinnipiac  Ave, New Haven, CT  06513\t\t\t\r\n\tUnit #\tOwner(s)\tPhone Number\temail if available\r\n\tA\tPeter & Rita Charles \t203-468-1288\tkrissann.charles@gmail.com\r\n\tB\tPriscilla Ruiz and Luz Miranda \t484-636-6261\t`\r\n\tC\tFelipe Pantoja\t203-804-9751\tminerva.miranda57@outlook.com  and pantojaf2001@hotmail.com\r\n\tD\tCatherine Fanning \t203-214-1944\tfanningcatherine@hotmail.com\r\n\tE\tMary F. Heyward (POW: Fuquana Heyward, niece)\t2035898864\tFuquana.heyward@yahoo.com\r\n\tF\tWilliam Ruiz\t203-676-4815\twilliamruiz11@gmail.com\r\n\tG\tDiane and Steve Torok - new owners\t203-400-4943 (cell)\tdhtorok@comcast.net\r\n\t\t\t\t\r\n\t1419 Quinnipiac Ave, New Haven, CT  06513\t\t\t\r\n\tUnit #\tOwner(s)\tPhone Number\temail if available\r\n\t1 Family\tTillman Lester AKA Lester J Jr\t203-823-5557\tlestertillman@hotmail.com\r\n\t\t\t\t\r\n\t\t\t\t\r\n\t1421 Quinnipiac Ave, New Haven, CT  06513\t\t\t\r\n\tUnit #\tOwner(s)\tPhone Number\temail if available\r\n\tA\tAndrew Simpson \t203-901-6150 (son) \tandrewsimpson96@yahoo.com\r\n\tB\tWilliam Ruiz \t203-676-4815\twilliamruiz11@gmail.com\r\n\tC\tWilliam Ruiz \t203-676-4815\twilliamruiz11@gmail.com\r\n\tD\tFelipe Pantoja  \t203-804-9751\tminerva.miranda57@outlook.com  and pantojaf2001@hotmail.com\r\n\tE\tThalia I Pantoja\t203-506-8855\tthalia.pantoja@yale.edu\r\n\tF\tLorraine Santiago\t203-243-0632\tlkmeals@gmail.com\r\n\tG\tMagen LLC  : Owner Allen  \t516-250-9326\tcondorentals26@gmail.com	\N	completed	admin@local	2026-03-09 16:14:56.47	2026-03-09 16:14:56.619	\N	2026-03-09 16:14:52.591323	2026-03-09 16:14:56.619	\N	\N
50607038-d5a7-4d78-b025-1442a6ab17cc	f301d073-ed84-4d73-84ce-3ef28af66f7a	pasted-text	\N	1415 Quinnipiac  Ave, New Haven, CT  06513\t\t\t\r\n\tUnit #\tOwner(s)\tPhone Number\temail if available\r\n\tA\tNsofor Robinson \t203-469-1363 or 203-980-1193\trnsofor@yahoo.com\r\n\tB\tGloria Oritsejafor  \t203-209-3642\tgachigasim@gmail.com\r\n\tC\tJose Omar Sanchez \t203-535-4821 \tjoseomarsanchez77@gmail.com\r\n\t\t\t\t\r\n\t1417 Quinnipiac  Ave, New Haven, CT  06513\t\t\t\r\n\tUnit #\tOwner(s)\tPhone Number\temail if available\r\n\tA\tPeter & Rita Charles \t203-468-1288\tkrissann.charles@gmail.com\r\n\tB\tPriscilla Ruiz and Luz Miranda \t484-636-6261\t`\r\n\tC\tFelipe Pantoja\t203-804-9751\tminerva.miranda57@outlook.com  and pantojaf2001@hotmail.com\r\n\tD\tCatherine Fanning \t203-214-1944\tfanningcatherine@hotmail.com\r\n\tE\tMary F. Heyward (POW: Fuquana Heyward, niece)\t2035898864\tFuquana.heyward@yahoo.com\r\n\tF\tWilliam Ruiz\t203-676-4815\twilliamruiz11@gmail.com\r\n\tG\tDiane and Steve Torok - new owners\t203-400-4943 (cell)\tdhtorok@comcast.net\r\n\t\t\t\t\r\n\t1419 Quinnipiac Ave, New Haven, CT  06513\t\t\t\r\n\tUnit #\tOwner(s)\tPhone Number\temail if available\r\n\t1 Family\tTillman Lester AKA Lester J Jr\t203-823-5557\tlestertillman@hotmail.com\r\n\t\t\t\t\r\n\t\t\t\t\r\n\t1421 Quinnipiac Ave, New Haven, CT  06513\t\t\t\r\n\tUnit #\tOwner(s)\tPhone Number\temail if available\r\n\tA\tAndrew Simpson \t203-901-6150 (son) \tandrewsimpson96@yahoo.com\r\n\tB\tWilliam Ruiz \t203-676-4815\twilliamruiz11@gmail.com\r\n\tC\tWilliam Ruiz \t203-676-4815\twilliamruiz11@gmail.com\r\n\tD\tFelipe Pantoja  \t203-804-9751\tminerva.miranda57@outlook.com  and pantojaf2001@hotmail.com\r\n\tE\tThalia I Pantoja\t203-506-8855\tthalia.pantoja@yale.edu\r\n\tF\tLorraine Santiago\t203-243-0632\tlkmeals@gmail.com\r\n\tG\tMagen LLC  : Owner Allen  \t516-250-9326\tcondorentals26@gmail.com	\N	completed	admin@local	2026-03-09 16:49:23.114	2026-03-09 16:49:23.359	\N	2026-03-09 16:49:14.320429	2026-03-09 16:49:23.359	here's a paste of the unit owners contact information with their units and building numbers. please review and add the units to the units database and add the owners to the owners list with their contact information.	\N
f74f1895-29fa-4a5c-95b1-84ada41b4f24	\N	pasted-text	invoice.txt	Vendor: Coastal Electric\nInvoice # INV-4021\nInvoice Date: 2025-01-10\nDue Date: 2025-01-24\nAmount Due: $842.35	\N	completed	benchmark@local	2026-03-09 19:46:43.274	2026-03-09 19:46:43.286	\N	2026-03-09 19:46:43.261691	2026-03-09 19:46:43.286	benchmark invoice draft	\N
1f542074-a1fc-4cf5-ac55-143efa924f5f	\N	pasted-text	statement.txt	Statement Period: 2025-01-01 to 2025-01-31\n2025-01-12 Unit A-201 HOA payment $-450.00\n2025-01-15 Unit A-202 Late fee $50.00	\N	completed	benchmark@local	2026-03-09 19:45:31.09	2026-03-09 19:45:31.259	\N	2026-03-09 19:45:31.0833	2026-03-09 19:45:31.259	benchmark bank statement	\N
d8356591-4c40-4668-a795-89daa80fe551	\N	pasted-text	contact-roster.csv	Name,Email,Phone,Mailing Address\nPat Jordan,pat.jordan@example.com,555-300-2222,300 Main St\nAvery Smith,avery.smith@example.com,555-300-2223,302 Main St	\N	completed	benchmark@local	2026-03-09 19:45:31.272	2026-03-09 19:45:31.286	\N	2026-03-09 19:45:31.268219	2026-03-09 19:45:31.286	benchmark contact roster	\N
4f15a24d-7125-48e5-830a-8dbabc7a6fa7	\N	pasted-text	invoice.txt	Vendor: Coastal Electric\nInvoice # INV-4021\nInvoice Date: 2025-01-10\nDue Date: 2025-01-24\nAmount Due: $842.35	\N	completed	benchmark@local	2026-03-09 19:45:31.294	2026-03-09 19:45:31.307	\N	2026-03-09 19:45:31.290706	2026-03-09 19:45:31.307	benchmark invoice draft	\N
6276099f-83f2-471d-9024-78c3fd9bb111	\N	pasted-text	contact-roster.csv	Name,Email,Phone,Mailing Address\nPat Jordan,pat.jordan@example.com,555-300-2222,300 Main St\nAvery Smith,avery.smith@example.com,555-300-2223,302 Main St	\N	completed	benchmark@local	2026-03-09 19:46:43.241	2026-03-09 19:46:43.254	\N	2026-03-09 19:46:43.236825	2026-03-09 19:46:43.254	benchmark contact roster	\N
7da95864-7920-4cb5-b2d3-a731a607cf9c	\N	pasted-text	minutes.txt	Board Meeting Minutes\nAgenda: budget update and reserve study\nResolution: approve 2026 budget draft	\N	completed	benchmark@local	2026-03-09 19:45:31.316	2026-03-09 19:45:31.34	\N	2026-03-09 19:45:31.311977	2026-03-09 19:45:31.34	benchmark meeting notes	\N
e969fef6-d2ab-416c-a274-790072596dd2	\N	pasted-text	statement.txt	Statement Period: 2025-01-01 to 2025-01-31\n2025-01-12 Unit A-201 HOA payment $-450.00\n2025-01-15 Unit A-202 Late fee $50.00	\N	completed	benchmark@local	2026-03-09 19:46:43.204	2026-03-09 19:46:43.229	\N	2026-03-09 19:46:43.195731	2026-03-09 19:46:43.229	benchmark bank statement	\N
1fa09545-fa3c-4771-a142-59f6551176e5	\N	pasted-text	minutes.txt	Board Meeting Minutes\nAgenda: budget update and reserve study\nResolution: approve 2026 budget draft	\N	completed	benchmark@local	2026-03-09 19:46:43.3	2026-03-09 19:46:43.326	\N	2026-03-09 19:46:43.292664	2026-03-09 19:46:43.326	benchmark meeting notes	\N
\.


--
-- Data for Name: annual_governance_tasks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.annual_governance_tasks (id, association_id, template_id, template_item_id, title, description, status, owner_person_id, due_date, completed_at, notes, created_at, updated_at, evidence_urls_json) FROM stdin;
\.


--
-- Data for Name: association_assets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.association_assets (id, association_id, unit_id, vendor_id, name, asset_type, manufacturer, model, serial_number, location, install_date, warranty_expires_at, last_serviced_at, next_service_due_at, estimated_lifespan_years, replacement_cost_estimate, condition, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: association_feature_flags; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.association_feature_flags (id, flag_id, association_id, enabled, rollout_percent, notes, updated_by, updated_at, created_at) FROM stdin;
\.


--
-- Data for Name: association_insurance_policies; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.association_insurance_policies (id, association_id, policy_type, carrier, policy_number, effective_date, expiration_date, premium_amount, coverage_amount, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: association_memberships; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.association_memberships (id, association_id, person_id, unit_id, membership_type, status, is_primary, created_at, updated_at) FROM stdin;
c2148c98-de75-4dda-afe2-58689cefbd3a	f301d073-ed84-4d73-84ce-3ef28af66f7a	2fcd7d8c-13c0-4d5b-96d3-0f2ec2131c65	7adb3521-845b-41de-8054-3281ddfc0f3c	tenant	active	1	2026-03-17 14:25:52.703986	2026-03-17 14:25:52.703
e21f5e88-1a85-49c3-8115-ed68141abd58	f301d073-ed84-4d73-84ce-3ef28af66f7a	f49f0d4b-01fd-4ea3-b8be-2d70229eb549	96696dfe-9feb-439a-ba29-88b79c5a74fd	owner	active	1	2026-03-16 18:21:29.254587	2026-03-16 18:21:29.254
ab4fca29-880a-4c87-b7e1-b3ad21831c83	f301d073-ed84-4d73-84ce-3ef28af66f7a	e64948e9-e5e2-4504-aae3-3023701d7602	f5d74705-ef3d-439d-bf89-a2c1c2a17f34	owner	active	1	2026-03-16 19:44:33.873522	2026-03-16 19:44:33.88
0a866322-9a5c-4b98-87a8-fd96d7c49e92	f301d073-ed84-4d73-84ce-3ef28af66f7a	bc4206ca-98dc-4284-9493-b874420e4374	f5d74705-ef3d-439d-bf89-a2c1c2a17f34	tenant	active	0	2026-03-16 19:44:33.909684	2026-03-16 19:44:33.915
71e3295f-be21-42b5-890d-39a5b9a01954	f301d073-ed84-4d73-84ce-3ef28af66f7a	e64948e9-e5e2-4504-aae3-3023701d7602	3d308aff-6712-4628-b812-e247c38ab92b	owner	active	1	2026-03-16 20:18:39.537448	2026-03-16 20:18:39.545
66d3b505-038a-4c26-b293-26c3f57e4291	f301d073-ed84-4d73-84ce-3ef28af66f7a	e64948e9-e5e2-4504-aae3-3023701d7602	3d308aff-6712-4628-b812-e247c38ab92b	tenant	active	0	2026-03-16 20:18:39.568155	2026-03-16 20:18:39.576
a952aab2-0539-41b4-962e-23b8ab30cf3f	f301d073-ed84-4d73-84ce-3ef28af66f7a	e64948e9-e5e2-4504-aae3-3023701d7602	a5b46109-1514-4207-9ed3-2b587ead617f	owner	active	1	2026-03-16 20:18:40.835296	2026-03-16 20:18:40.84
480b6f82-63c2-4538-b9ee-a22ddbcac836	f301d073-ed84-4d73-84ce-3ef28af66f7a	c20a508c-c0a1-42dc-8bee-4c7afd45d117	a5b46109-1514-4207-9ed3-2b587ead617f	tenant	active	0	2026-03-16 20:18:40.860075	2026-03-16 20:18:40.866
282ee974-655b-48f7-8551-bc59d8748bd3	f301d073-ed84-4d73-84ce-3ef28af66f7a	5dd27a32-c1ee-4826-bf18-db9df778eea3	341b2050-28cf-4d3d-bc44-ef5a0f6584d9	owner	active	1	2026-03-16 22:52:54.445383	2026-03-16 22:52:54.467
91273fef-e5aa-4ff4-844b-07b898653f8d	f301d073-ed84-4d73-84ce-3ef28af66f7a	3d5f7fc5-c5f6-4dcd-bfe6-cade8e8e2258	91e77ac7-b0dc-4bab-a169-f167b20e5cce	owner	active	0	2026-03-16 22:52:55.586469	2026-03-16 22:52:55.616
897032d2-f5f0-4ea9-97f6-678824290f58	f301d073-ed84-4d73-84ce-3ef28af66f7a	acf06065-a75c-45ab-9c55-b5fddecef158	91e77ac7-b0dc-4bab-a169-f167b20e5cce	tenant	active	0	2026-03-16 22:52:55.637937	2026-03-16 22:52:55.645
0cb66fe8-1b31-4a9b-81cc-1544a748437a	f301d073-ed84-4d73-84ce-3ef28af66f7a	5c600f8c-c59d-49ae-bdcd-94c8ef1c4625	909ed4e8-fb53-49f8-aecf-5b56c10e1e30	owner	active	1	2026-03-17 01:21:02.709345	2026-03-17 01:21:02.728
61c1382c-d39b-4293-bea7-17858ab4acb4	f301d073-ed84-4d73-84ce-3ef28af66f7a	2fcd7d8c-13c0-4d5b-96d3-0f2ec2131c65	7adb3521-845b-41de-8054-3281ddfc0f3c	owner	active	1	2026-03-17 13:58:43.72536	2026-03-17 13:58:43.724
f3ec7088-8563-4dbd-a90a-cbe65bef51f2	f301d073-ed84-4d73-84ce-3ef28af66f7a	0892c9b2-1cc1-4e21-bd9b-68bd1ce2e521	f5d74705-ef3d-439d-bf89-a2c1c2a17f34	owner	active	1	2026-03-17 14:00:40.886288	2026-03-17 14:00:40.886
\.


--
-- Data for Name: associations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.associations (id, name, address, city, state, country, created_at, is_archived, archived_at, association_type, date_formed, ein) FROM stdin;
7a1f216a-8ac9-4fe9-a8d2-b62b01565a42	Lakewood Residences	450 Lakeview Blvd	Chicago	IL	USA	2026-03-06 16:20:53.680477	0	\N	\N	\N	\N
f627dc9b-cde0-44c0-a23a-405487cb0add	Pacific Heights Condos	789 Bay Street	San Francisco	CA	USA	2026-03-06 16:20:53.680477	0	\N	\N	\N	\N
e60c349e-b14e-48fa-a72e-8af3c2180c74	Sunset Towers	1200 Ocean Drive	Miami	FL	USA	2026-03-06 16:20:53.680477	0	\N	\N	\N	\N
7c164b67-9e3b-456a-bb49-dd698b0822c4	Verification HOA 1773579706183	1 Verification Way	New Haven	CT	USA	2026-03-15 13:01:46.23835	1	2026-03-17 13:50:01.746	condo	\N	\N
628b7d4b-b052-44a5-9bcc-69784581450c	Cherry Hill Court	101 Cherry Hill Court	Cherry Hill	NJ	USA	2026-03-15 14:59:57.296436	1	2026-03-17 13:50:03.428	condo	\N	\N
1c63e35c-2ac3-4b0a-b2ab-61f873d0d938	Test Towers	100 Test Ave	Austin	TX	USA	2026-03-06 16:23:32.832535	1	2026-03-17 13:50:05.737	\N	\N	\N
ba806fad-1586-4013-ab62-18cbb360b007	Dbg Assoc	1	x	TX	USA	2026-03-09 15:39:46.428266	1	2026-03-17 13:50:08.478	\N	\N	\N
2d2c9b21-99cd-4a41-b04b-d52a59c90adf	M1 Verify 03c6c06b-3e4f-40b4-847b-cb9d18b8bedb	1 Audit Way	New Haven	CT	USA	2026-03-17 14:08:06.120251	0	\N	\N	\N	\N
6b88913f-a682-4885-b965-2227238ca1a7	M2 Verify cfb8fdae-4d21-489d-bbb3-003fa7de6937	2 Budget Lane	New Haven	CT	USA	2026-03-17 14:08:06.278578	0	\N	\N	\N	\N
f301d073-ed84-4d73-84ce-3ef28af66f7a	Cherry Hill Court Condominiums	1405 Quinnipiac Ave.	New Haven	CT	USA	2026-03-07 17:15:42.39432	0	\N	HOA	1990-07-16	06-1513429
5d4488b7-c229-4412-8762-d822e4f150f3	QA Communications Foundation 364067	100 Verification Way	New Haven	CT	USA	2026-03-11 14:12:44.087108	1	2026-03-17 13:49:57.152	\N	\N	\N
f61e4b10-01a3-4670-87b3-c2a7749b2958	Building First Verify A 092492	100 Verify Way	Austin	TX	USA	2026-03-12 16:31:32.513091	1	2026-03-17 13:49:58.782	\N	\N	\N
8c579997-ec38-4389-9e78-dbf34ba80947	Building First Verify B 092492	200 Verify Way	Austin	TX	USA	2026-03-12 16:31:32.525605	1	2026-03-17 13:50:00.478	\N	\N	\N
8a54bd02-ce91-43e5-9025-9727e51dd81a	M3 Verify 87248c5d-343a-42ec-99d6-cbe04fe32d6f	3 Governance Ave	New Haven	CT	USA	2026-03-17 14:08:06.284571	0	\N	\N	\N	\N
1487980c-c1fe-4c63-b0af-519c0a6b0df3	M3 Verify fdff42d9-c271-4753-9ce6-29abcffbfe07	3 Governance Ave	New Haven	CT	USA	2026-03-17 14:08:06.388544	0	\N	\N	\N	\N
824957e1-af38-43ec-af76-328d92556945	M4 Verify 01560bd0	4 Intelligence Way	Cambridge	MA	USA	2026-03-17 14:08:06.680439	0	\N	\N	\N	\N
1f6dc2f6-8910-48c0-a6c3-16542a2bd72a	M5 A 771782db	500 A Street	Boston	MA	USA	2026-03-17 14:08:06.99629	0	\N	\N	\N	\N
b6bfa018-b74e-4731-aa57-da96552e2278	M5 B 771782db	501 B Street	Boston	MA	USA	2026-03-17 14:08:07.003628	0	\N	\N	\N	\N
5f8d45b1-a6f7-4396-8657-1b814d757c72	M5 A 144ac799	500 A Street	Boston	MA	USA	2026-03-17 14:08:07.008982	0	\N	\N	\N	\N
db729561-9dfc-457e-a4b8-ee75e723f65c	M5 B 144ac799	501 B Street	Boston	MA	USA	2026-03-17 14:08:07.434588	0	\N	\N	\N	\N
a913c7ae-3f37-441e-9ed5-4d7ef10c3b21	M2 Verify 80b04465-bc8b-4ec8-b65d-42cb833102f2	2 Budget Lane	New Haven	CT	USA	2026-03-17 14:08:07.489798	0	\N	\N	\N	\N
7f04cf6b-03c3-4ad8-984e-cb5f8c0ec7f2	M3 Verify 1903372c-1ffb-4545-92a0-d00e9f2b11a7	3 Governance Ave	New Haven	CT	USA	2026-03-17 14:08:07.493875	0	\N	\N	\N	\N
7e2f8aac-bc06-4f94-9cbd-008394f47f9b	M4 Verify a2ccb5de	4 Intelligence Way	Cambridge	MA	USA	2026-03-17 14:08:07.497153	0	\N	\N	\N	\N
341eef63-da08-45dc-bcd5-b814a22f951d	M5 A 5b429e33	500 A Street	Boston	MA	USA	2026-03-17 14:08:07.508099	0	\N	\N	\N	\N
ac273593-4859-4d12-a893-fc590759a1e0	M5 B 5b429e33	501 B Street	Boston	MA	USA	2026-03-17 14:08:07.511992	0	\N	\N	\N	\N
767ae794-3b7c-4c81-aa24-257018e4366c	AI Ingestion Verify 546983	100 Test Way	Austin	TX	USA	2026-03-17 14:08:07.515697	0	\N	\N	\N	\N
8b3a1209-6a15-4905-ba11-1f2e281e542b	AI Ingestion Benchmark 705630	1 Benchmark Plaza	Austin	TX	USA	2026-03-17 14:08:07.518614	0	\N	\N	\N	\N
03bf6db8-4f11-46ce-b407-55fb1608bb1a	AI Ingestion Benchmark 724980	1 Benchmark Plaza	Austin	TX	USA	2026-03-17 14:08:07.521347	0	\N	\N	\N	\N
13437a4d-4e3e-43fd-9f3f-8363795611da	AI Ingestion Benchmark 747307	1 Benchmark Plaza	Austin	TX	USA	2026-03-17 14:08:07.525001	0	\N	\N	\N	\N
2de5f8cb-cc8b-4869-88a4-2a899202f226	AI Ingestion Benchmark 773059	1 Benchmark Plaza	Austin	TX	USA	2026-03-17 14:08:07.528078	0	\N	\N	\N	\N
698f44b6-785f-412a-8ce9-f66ba590e943	AI Ingestion Verify 831011	100 Test Way	Austin	TX	USA	2026-03-17 14:08:07.531647	0	\N	\N	\N	\N
acb54c9d-163e-4417-b668-b8e5e96f9341	AI Ingestion Benchmark 831011	1 Benchmark Plaza	Austin	TX	USA	2026-03-17 14:08:07.534285	0	\N	\N	\N	\N
a6edd39e-1e6d-400f-8a41-18d693b3116f	AI Ingestion Benchmark 377049	1 Benchmark Plaza	Austin	TX	USA	2026-03-17 14:08:07.537537	0	\N	\N	\N	\N
1aed21af-1a0f-4a88-9876-38ef412e71cd	AI Ingestion Verify 377141	100 Test Way	Austin	TX	USA	2026-03-17 14:08:07.540974	0	\N	\N	\N	\N
0c191726-f468-4fab-9700-4d9518b283f6	AI Ingestion Benchmark 530772	1 Benchmark Plaza	Austin	TX	USA	2026-03-17 14:08:07.543319	0	\N	\N	\N	\N
1d80ac65-beb0-4008-84f9-a51ade5702a5	AI Ingestion Benchmark 603122	1 Benchmark Plaza	Austin	TX	USA	2026-03-17 14:08:07.546137	0	\N	\N	\N	\N
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_logs (id, actor_email, action, entity_type, entity_id, association_id, before_json, after_json, created_at) FROM stdin;
c258cba6-292d-4daa-8da5-030ecbc11391	m1-verify-1772905759528@local	create	person	811b7fae-c1c4-4276-8efc-ee6eb8721147	\N	\N	{"id": "811b7fae-c1c4-4276-8efc-ee6eb8721147", "email": "03c6c06b@example.com", "phone": "555-1000", "lastName": "Tester", "createdAt": "2026-03-07T17:49:19.631Z", "firstName": "Audit", "mailingAddress": "1 Audit Way"}	2026-03-07 17:49:19.64368
dcf474b6-5cd1-4c74-8a24-0fff683a6f0f	m1-verify-1772905759528@local	create	person	94aa6413-e209-4554-a7b3-9d05cf099c1b	\N	\N	{"id": "94aa6413-e209-4554-a7b3-9d05cf099c1b", "email": "03c6c06b-board@example.com", "phone": null, "lastName": "Member", "createdAt": "2026-03-07T17:49:19.701Z", "firstName": "Board", "mailingAddress": null}	2026-03-07 17:49:19.706293
18d5d899-16d9-4eef-a7be-cc08dfb669e3	m1-verify-1772905759528@local	delete	person	94aa6413-e209-4554-a7b3-9d05cf099c1b	\N	{"id": "94aa6413-e209-4554-a7b3-9d05cf099c1b", "email": "03c6c06b-board@example.com", "phone": null, "lastName": "Member", "createdAt": "2026-03-07T17:49:19.701Z", "firstName": "Board", "mailingAddress": null}	\N	2026-03-07 17:49:19.803128
4d8fcd85-85e7-4e76-836c-21e21e56f409	m1-verify-1772905759528@local	delete	person	811b7fae-c1c4-4276-8efc-ee6eb8721147	\N	{"id": "811b7fae-c1c4-4276-8efc-ee6eb8721147", "email": "03c6c06b@example.com", "phone": "555-1000", "lastName": "Tester", "createdAt": "2026-03-07T17:49:19.631Z", "firstName": "Audit", "mailingAddress": "1 Audit Way"}	\N	2026-03-07 17:49:19.815138
f9f0e48f-aace-497b-8d21-8db6b5cb4019	m1-verify-1772905785303@local	create	person	f691f37c-55aa-4078-b990-0c8b2a8943a9	\N	\N	{"id": "f691f37c-55aa-4078-b990-0c8b2a8943a9", "email": "b7f4926d@example.com", "phone": "555-1000", "lastName": "Tester", "createdAt": "2026-03-07T17:49:45.372Z", "firstName": "Audit", "mailingAddress": "1 Audit Way"}	2026-03-07 17:49:45.375971
68847f56-588a-46bf-a96c-bbdb6e7ce6a3	m1-verify-1772905785303@local	create	person	912b8990-6da1-4e51-8e17-6767f8895530	\N	\N	{"id": "912b8990-6da1-4e51-8e17-6767f8895530", "email": "b7f4926d-board@example.com", "phone": null, "lastName": "Member", "createdAt": "2026-03-07T17:49:45.418Z", "firstName": "Board", "mailingAddress": null}	2026-03-07 17:49:45.433256
76aa7ff8-4f62-49e9-bed2-2f3cfc031480	m1-verify-1772905785303@local	delete	person	912b8990-6da1-4e51-8e17-6767f8895530	\N	{"id": "912b8990-6da1-4e51-8e17-6767f8895530", "email": "b7f4926d-board@example.com", "phone": null, "lastName": "Member", "createdAt": "2026-03-07T17:49:45.418Z", "firstName": "Board", "mailingAddress": null}	\N	2026-03-07 17:49:45.509184
b1fbc1c4-f70f-4c12-8277-d9c0170e89b2	m1-verify-1772905785303@local	delete	person	f691f37c-55aa-4078-b990-0c8b2a8943a9	\N	{"id": "f691f37c-55aa-4078-b990-0c8b2a8943a9", "email": "b7f4926d@example.com", "phone": "555-1000", "lastName": "Tester", "createdAt": "2026-03-07T17:49:45.372Z", "firstName": "Audit", "mailingAddress": "1 Audit Way"}	\N	2026-03-07 17:49:45.550047
1fd2883e-c954-4a7b-9fef-972f18a0a670	m1-verify-1772905785303@local	create	association	1b7badf2-947c-4bc7-8d52-c0852c415fbc	\N	\N	{"id": "1b7badf2-947c-4bc7-8d52-c0852c415fbc", "city": "New Haven", "name": "M1 Verify b7f4926d-610d-4b22-a89a-1d3c7018fec4", "state": "CT", "address": "1 Audit Way", "country": "USA", "createdAt": "2026-03-07T17:49:45.325Z"}	2026-03-07 17:49:45.341069
7eaa9c41-91bd-4aa8-a3e8-c3bd7177b6bf	m1-verify-1772905785303@local	create	unit	c8fa9176-3bd0-444a-915f-bb680a5c7dfb	\N	\N	{"id": "c8fa9176-3bd0-444a-915f-bb680a5c7dfb", "building": "A", "createdAt": "2026-03-07T17:49:45.364Z", "unitNumber": "U-b7f492", "associationId": "1b7badf2-947c-4bc7-8d52-c0852c415fbc", "squareFootage": 900}	2026-03-07 17:49:45.369251
ec36577c-73d8-466a-8667-7606901be89c	m1-verify-1772905785303@local	create	ownership	efa8fe22-00df-4b67-937f-b7ab8df2d1b3	\N	\N	{"id": "efa8fe22-00df-4b67-937f-b7ab8df2d1b3", "unitId": "c8fa9176-3bd0-444a-915f-bb680a5c7dfb", "endDate": null, "personId": "f691f37c-55aa-4078-b990-0c8b2a8943a9", "startDate": "2026-03-07T17:49:45.378Z", "ownershipPercentage": 100}	2026-03-07 17:49:45.3851
8d7e1699-c11b-4874-9e1b-d6d96b4feb82	m1-verify-1772905785303@local	delete	ownership	efa8fe22-00df-4b67-937f-b7ab8df2d1b3	\N	{"id": "efa8fe22-00df-4b67-937f-b7ab8df2d1b3", "unitId": "c8fa9176-3bd0-444a-915f-bb680a5c7dfb", "endDate": null, "personId": "f691f37c-55aa-4078-b990-0c8b2a8943a9", "startDate": "2026-03-07T17:49:45.378Z", "ownershipPercentage": 100}	\N	2026-03-07 17:49:45.406087
7606da45-7323-445a-aa12-5292047eb906	m1-verify-1772905785303@local	delete	unit	c8fa9176-3bd0-444a-915f-bb680a5c7dfb	\N	{"id": "c8fa9176-3bd0-444a-915f-bb680a5c7dfb", "building": "A", "createdAt": "2026-03-07T17:49:45.364Z", "unitNumber": "U-b7f492", "associationId": "1b7badf2-947c-4bc7-8d52-c0852c415fbc", "squareFootage": 900}	\N	2026-03-07 17:49:45.415453
29133537-69d2-4b16-b6d6-5720af47ac76	m1-verify-1772905785303@local	create	board-role	4c1e6c9f-f7ed-4a4d-8f06-efab645cc4a5	\N	\N	{"id": "4c1e6c9f-f7ed-4a4d-8f06-efab645cc4a5", "role": "Secretary", "endDate": null, "personId": "912b8990-6da1-4e51-8e17-6767f8895530", "startDate": "2026-03-07T17:49:45.436Z", "associationId": "1b7badf2-947c-4bc7-8d52-c0852c415fbc"}	2026-03-07 17:49:45.441478
2a829322-68b2-406e-9cd0-ac4b63e6bb4b	m1-verify-1772905785303@local	create	document	62b31ae0-46c7-42b8-8b4b-15eb9376537c	\N	\N	{"id": "62b31ae0-46c7-42b8-8b4b-15eb9376537c", "title": "Doc b7f4926d-610d-4b22-a89a-1d3c7018fec4", "fileUrl": "/api/uploads/mock.pdf", "createdAt": "2026-03-07T17:49:45.444Z", "uploadedBy": "m1-verify-1772905785303@local", "documentType": "minutes", "associationId": "1b7badf2-947c-4bc7-8d52-c0852c415fbc"}	2026-03-07 17:49:45.453302
945b79e5-beee-49e7-88eb-f43fc4d94a70	m1-verify-1772905785303@local	create	document-tag	46753044-5eff-43d4-a28a-bc9ffd2e548b	\N	\N	{"id": "46753044-5eff-43d4-a28a-bc9ffd2e548b", "entityId": "1b7badf2-947c-4bc7-8d52-c0852c415fbc", "createdAt": "2026-03-07T17:49:45.457Z", "documentId": "62b31ae0-46c7-42b8-8b4b-15eb9376537c", "entityType": "association"}	2026-03-07 17:49:45.462448
cf560af0-37f4-4a21-9122-9eec6cfac735	m1-verify-1772905785303@local	create	document-version	9a85c949-85f0-4a8e-85a9-c09170a48c01	\N	\N	{"id": "9a85c949-85f0-4a8e-85a9-c09170a48c01", "title": "Doc b7f4926d-610d-4b22-a89a-1d3c7018fec4 v2", "fileUrl": "/api/uploads/mock-v2.pdf", "createdAt": "2026-03-07T17:49:45.466Z", "documentId": "62b31ae0-46c7-42b8-8b4b-15eb9376537c", "uploadedBy": "m1-verify-1772905785303@local", "versionNumber": 2}	2026-03-07 17:49:45.471458
f689de7d-4984-46da-b88f-98a37f696a14	m1-verify-1772905785303@local	delete	document	62b31ae0-46c7-42b8-8b4b-15eb9376537c	\N	{"id": "62b31ae0-46c7-42b8-8b4b-15eb9376537c", "title": "Doc b7f4926d-610d-4b22-a89a-1d3c7018fec4", "fileUrl": "/api/uploads/mock.pdf", "createdAt": "2026-03-07T17:49:45.444Z", "uploadedBy": "m1-verify-1772905785303@local", "documentType": "minutes", "associationId": "1b7badf2-947c-4bc7-8d52-c0852c415fbc"}	\N	2026-03-07 17:49:45.492991
0fcf367c-87a2-4ef7-8fc4-f516e181ec22	m1-verify-1772905785303@local	delete	board-role	4c1e6c9f-f7ed-4a4d-8f06-efab645cc4a5	\N	{"id": "4c1e6c9f-f7ed-4a4d-8f06-efab645cc4a5", "role": "Secretary", "endDate": null, "personId": "912b8990-6da1-4e51-8e17-6767f8895530", "startDate": "2026-03-07T17:49:45.436Z", "associationId": "1b7badf2-947c-4bc7-8d52-c0852c415fbc"}	\N	2026-03-07 17:49:45.499549
3b5621dd-f14d-4cda-9b74-3b794dad8faf	m1-verify-1772905785303@local	delete	association	1b7badf2-947c-4bc7-8d52-c0852c415fbc	\N	{"id": "1b7badf2-947c-4bc7-8d52-c0852c415fbc", "city": "New Haven", "name": "M1 Verify b7f4926d-610d-4b22-a89a-1d3c7018fec4", "state": "CT", "address": "1 Audit Way", "country": "USA", "createdAt": "2026-03-07T17:49:45.325Z"}	\N	2026-03-07 17:49:45.575366
8aef79c0-7f47-406b-9e62-a73ad63dda9d	m5-verify-1772907779277@local	create	person	6ee42f4c-367f-4846-b956-3f5c71c77ce1	\N	\N	{"id": "6ee42f4c-367f-4846-b956-3f5c71c77ce1", "email": "owner-a-771782db@local", "phone": null, "lastName": "A", "createdAt": "2026-03-07T18:22:59.323Z", "firstName": "Owner", "mailingAddress": "Old Address"}	2026-03-07 18:22:59.326035
fa7e1006-7c32-464c-bdcb-00790688adec	m5-verify-1772907779277@local	create	person	28d6ffca-94ef-4550-b5c3-226e291848be	\N	\N	{"id": "28d6ffca-94ef-4550-b5c3-226e291848be", "email": "owner-b-771782db@local", "phone": null, "lastName": "B", "createdAt": "2026-03-07T18:22:59.329Z", "firstName": "Owner", "mailingAddress": null}	2026-03-07 18:22:59.333183
6b7d516f-1aca-462e-8f28-f96e9ae54565	m5-verify-1772907792763@local	create	person	6ae0df0d-b1ad-473a-adae-3d2f03bf8833	\N	\N	{"id": "6ae0df0d-b1ad-473a-adae-3d2f03bf8833", "email": "owner-a-144ac799@local", "phone": null, "lastName": "A", "createdAt": "2026-03-07T18:23:12.803Z", "firstName": "Owner", "mailingAddress": "Old Address"}	2026-03-07 18:23:12.806477
2d30f206-67cc-471d-a202-6ee8ad4183db	m5-verify-1772907792763@local	create	person	90244190-fc1e-4ee0-bc75-211976bfa542	\N	\N	{"id": "90244190-fc1e-4ee0-bc75-211976bfa542", "email": "owner-b-144ac799@local", "phone": null, "lastName": "B", "createdAt": "2026-03-07T18:23:12.808Z", "firstName": "Owner", "mailingAddress": null}	2026-03-07 18:23:12.811799
11594f5b-fc6a-466f-9ba7-005347b77dbd	m1-verify-1772908640970@local	create	person	633a179e-baed-4685-b491-dbf7827d8d1e	\N	\N	{"id": "633a179e-baed-4685-b491-dbf7827d8d1e", "email": "0d7073af@example.com", "phone": "555-1000", "lastName": "Tester", "createdAt": "2026-03-07T18:37:21.020Z", "firstName": "Audit", "mailingAddress": "1 Audit Way"}	2026-03-07 18:37:21.02337
88ac8c91-8372-499d-b57c-8bfb81acdf8f	m1-verify-1772908640970@local	create	person	3f4d6264-9899-49ad-b921-ff944bfd98e5	\N	\N	{"id": "3f4d6264-9899-49ad-b921-ff944bfd98e5", "email": "0d7073af-board@example.com", "phone": null, "lastName": "Member", "createdAt": "2026-03-07T18:37:21.060Z", "firstName": "Board", "mailingAddress": null}	2026-03-07 18:37:21.063714
cc168b93-69e5-4f7a-a32d-6c3525797532	m1-verify-1772908640970@local	delete	person	3f4d6264-9899-49ad-b921-ff944bfd98e5	\N	{"id": "3f4d6264-9899-49ad-b921-ff944bfd98e5", "email": "0d7073af-board@example.com", "phone": null, "lastName": "Member", "createdAt": "2026-03-07T18:37:21.060Z", "firstName": "Board", "mailingAddress": null}	\N	2026-03-07 18:37:21.123985
c1a1b9af-8662-42c6-a9be-0186c5428937	m1-verify-1772908640970@local	delete	person	633a179e-baed-4685-b491-dbf7827d8d1e	\N	{"id": "633a179e-baed-4685-b491-dbf7827d8d1e", "email": "0d7073af@example.com", "phone": "555-1000", "lastName": "Tester", "createdAt": "2026-03-07T18:37:21.020Z", "firstName": "Audit", "mailingAddress": "1 Audit Way"}	\N	2026-03-07 18:37:21.13162
e00c1889-d69e-4af7-be66-d520197d5666	m1-verify-1772908640970@local	create	association	2dade228-59f2-4d7d-9ee7-28217c6650c7	\N	\N	{"id": "2dade228-59f2-4d7d-9ee7-28217c6650c7", "city": "New Haven", "name": "M1 Verify 0d7073af-9562-410e-9fc9-1d423526824c", "state": "CT", "address": "1 Audit Way", "country": "USA", "createdAt": "2026-03-07T18:37:21.003Z"}	2026-03-07 18:37:21.008897
e2fcf293-f0c0-4378-b59d-9461afed1a07	m1-verify-1772908640970@local	create	unit	5cf59393-6ab6-44f6-b405-085c4b8ceec8	\N	\N	{"id": "5cf59393-6ab6-44f6-b405-085c4b8ceec8", "building": "A", "createdAt": "2026-03-07T18:37:21.013Z", "unitNumber": "U-0d7073", "associationId": "2dade228-59f2-4d7d-9ee7-28217c6650c7", "squareFootage": 900}	2026-03-07 18:37:21.016746
ac774b96-98d5-4314-91de-6e486b03ba42	m1-verify-1772908640970@local	create	ownership	61a7e730-15e7-4b3f-9661-cb377918d5e6	\N	\N	{"id": "61a7e730-15e7-4b3f-9661-cb377918d5e6", "unitId": "5cf59393-6ab6-44f6-b405-085c4b8ceec8", "endDate": null, "personId": "633a179e-baed-4685-b491-dbf7827d8d1e", "startDate": "2026-03-07T18:37:21.026Z", "ownershipPercentage": 100}	2026-03-07 18:37:21.034011
4fde7b52-bfc4-445e-a4c5-6239115428c5	m1-verify-1772908640970@local	delete	ownership	61a7e730-15e7-4b3f-9661-cb377918d5e6	\N	{"id": "61a7e730-15e7-4b3f-9661-cb377918d5e6", "unitId": "5cf59393-6ab6-44f6-b405-085c4b8ceec8", "endDate": null, "personId": "633a179e-baed-4685-b491-dbf7827d8d1e", "startDate": "2026-03-07T18:37:21.026Z", "ownershipPercentage": 100}	\N	2026-03-07 18:37:21.044317
8d178b97-4902-4a36-8850-b420affe78b9	m1-verify-1772908640970@local	delete	unit	5cf59393-6ab6-44f6-b405-085c4b8ceec8	\N	{"id": "5cf59393-6ab6-44f6-b405-085c4b8ceec8", "building": "A", "createdAt": "2026-03-07T18:37:21.013Z", "unitNumber": "U-0d7073", "associationId": "2dade228-59f2-4d7d-9ee7-28217c6650c7", "squareFootage": 900}	\N	2026-03-07 18:37:21.057203
3ef9e9f4-cdc7-4ec8-b93a-6de061dda4f7	m1-verify-1772908640970@local	create	board-role	59271568-0aaa-4e94-87a4-17d440e6973d	\N	\N	{"id": "59271568-0aaa-4e94-87a4-17d440e6973d", "role": "Secretary", "endDate": null, "personId": "3f4d6264-9899-49ad-b921-ff944bfd98e5", "startDate": "2026-03-07T18:37:21.066Z", "associationId": "2dade228-59f2-4d7d-9ee7-28217c6650c7"}	2026-03-07 18:37:21.070981
562155a2-b6b3-42a9-a34e-94b48dde3f10	m1-verify-1772908640970@local	create	document	61aefc10-bd10-4377-a0b2-9b5cf3e48299	\N	\N	{"id": "61aefc10-bd10-4377-a0b2-9b5cf3e48299", "title": "Doc 0d7073af-9562-410e-9fc9-1d423526824c", "fileUrl": "/api/uploads/mock.pdf", "createdAt": "2026-03-07T18:37:21.074Z", "uploadedBy": "m1-verify-1772908640970@local", "documentType": "minutes", "associationId": "2dade228-59f2-4d7d-9ee7-28217c6650c7", "portalAudience": "owner", "isPortalVisible": 0}	2026-03-07 18:37:21.081906
1c320ec1-8246-4a74-be75-5e739d3ebca3	m1-verify-1772908640970@local	create	document-tag	62fb9a1e-3ca5-457f-8cde-6500e36c697e	\N	\N	{"id": "62fb9a1e-3ca5-457f-8cde-6500e36c697e", "entityId": "2dade228-59f2-4d7d-9ee7-28217c6650c7", "createdAt": "2026-03-07T18:37:21.084Z", "documentId": "61aefc10-bd10-4377-a0b2-9b5cf3e48299", "entityType": "association"}	2026-03-07 18:37:21.088044
a35a10bc-cc80-4c2c-98f7-4558e371122b	m1-verify-1772908640970@local	create	document-version	11dc0e6c-1c05-49d2-9435-ce58ba0b1b7a	\N	\N	{"id": "11dc0e6c-1c05-49d2-9435-ce58ba0b1b7a", "title": "Doc 0d7073af-9562-410e-9fc9-1d423526824c v2", "fileUrl": "/api/uploads/mock-v2.pdf", "createdAt": "2026-03-07T18:37:21.091Z", "documentId": "61aefc10-bd10-4377-a0b2-9b5cf3e48299", "uploadedBy": "m1-verify-1772908640970@local", "versionNumber": 2}	2026-03-07 18:37:21.094908
6a49f6a7-464a-4915-a24b-d31d6f1d972e	m1-verify-1772908640970@local	delete	document	61aefc10-bd10-4377-a0b2-9b5cf3e48299	\N	{"id": "61aefc10-bd10-4377-a0b2-9b5cf3e48299", "title": "Doc 0d7073af-9562-410e-9fc9-1d423526824c", "fileUrl": "/api/uploads/mock.pdf", "createdAt": "2026-03-07T18:37:21.074Z", "uploadedBy": "m1-verify-1772908640970@local", "documentType": "minutes", "associationId": "2dade228-59f2-4d7d-9ee7-28217c6650c7", "portalAudience": "owner", "isPortalVisible": 0}	\N	2026-03-07 18:37:21.106829
cfa6c3ec-1ba9-4aa0-958a-b9eb65a59f1f	m1-verify-1772908640970@local	delete	board-role	59271568-0aaa-4e94-87a4-17d440e6973d	\N	{"id": "59271568-0aaa-4e94-87a4-17d440e6973d", "role": "Secretary", "endDate": null, "personId": "3f4d6264-9899-49ad-b921-ff944bfd98e5", "startDate": "2026-03-07T18:37:21.066Z", "associationId": "2dade228-59f2-4d7d-9ee7-28217c6650c7"}	\N	2026-03-07 18:37:21.113398
7d89178d-0dca-4beb-83b3-c686784998a3	m1-verify-1772908640970@local	delete	association	2dade228-59f2-4d7d-9ee7-28217c6650c7	\N	{"id": "2dade228-59f2-4d7d-9ee7-28217c6650c7", "city": "New Haven", "name": "M1 Verify 0d7073af-9562-410e-9fc9-1d423526824c", "state": "CT", "address": "1 Audit Way", "country": "USA", "createdAt": "2026-03-07T18:37:21.003Z"}	\N	2026-03-07 18:37:21.149536
b17c6968-157c-43d2-ae0c-cb8268d26d8d	m5-verify-1772908684646@local	create	person	084f023f-ba12-484d-872d-ee4c0bbaf226	\N	\N	{"id": "084f023f-ba12-484d-872d-ee4c0bbaf226", "email": "owner-a-5b429e33@local", "phone": null, "lastName": "A", "createdAt": "2026-03-07T18:38:04.689Z", "firstName": "Owner", "mailingAddress": "Old Address"}	2026-03-07 18:38:04.692369
84ee835e-9e8d-47f6-96f9-735f0d110453	m5-verify-1772908684646@local	create	person	33402f2c-88ad-4b6d-b0f0-6e9f70d8448e	\N	\N	{"id": "33402f2c-88ad-4b6d-b0f0-6e9f70d8448e", "email": "owner-b-5b429e33@local", "phone": null, "lastName": "B", "createdAt": "2026-03-07T18:38:04.695Z", "firstName": "Owner", "mailingAddress": null}	2026-03-07 18:38:04.699186
f691ed8c-ec92-41f3-8295-22e9e28a0597	verifier@local	create	person	f6037f39-f74f-4357-aa30-a0e01453c9be	\N	\N	{"id": "f6037f39-f74f-4357-aa30-a0e01453c9be", "email": "verify-546983@example.com", "phone": "555-100-0000", "lastName": "Verifier546983", "createdAt": "2026-03-09T15:35:47.074Z", "firstName": "Taylor", "mailingAddress": "100 Test Way"}	2026-03-09 15:35:47.080223
35c06fb5-f65f-4fd2-b5e6-e49edda041da	dbg@local	create	association	ba806fad-1586-4013-ab62-18cbb360b007	ba806fad-1586-4013-ab62-18cbb360b007	\N	{"id": "ba806fad-1586-4013-ab62-18cbb360b007", "city": "x", "name": "Dbg Assoc", "state": "TX", "address": "1", "country": "USA", "createdAt": "2026-03-09T15:39:46.428Z"}	2026-03-09 15:39:46.436478
4c1b3c62-7f35-4b80-a299-125ee356792a	verifier@local	create	person	c74a1999-eba0-4c9c-9b3b-dd931da43f6b	\N	\N	{"id": "c74a1999-eba0-4c9c-9b3b-dd931da43f6b", "email": "verify-831011@example.com", "phone": "555-100-0000", "lastName": "Verifier831011", "createdAt": "2026-03-09T15:40:31.067Z", "firstName": "Taylor", "mailingAddress": "100 Test Way"}	2026-03-09 15:40:31.075199
2a53f879-9274-4e07-b2c2-0af719a8029a	verifier@local	create	person	305e514f-ea47-4a27-9704-72d3772f4c00	\N	\N	{"id": "305e514f-ea47-4a27-9704-72d3772f4c00", "email": "verify-377141@example.com", "phone": "555-100-0000", "lastName": "Verifier377141", "createdAt": "2026-03-09T15:49:37.196Z", "firstName": "Taylor", "mailingAddress": "100 Test Way"}	2026-03-09 15:49:37.202732
5f689a8a-b255-4768-b7e8-acbaf63b7c46	admin@local	create	unit	f589dc59-4725-450c-a26f-64e322730fef	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "f589dc59-4725-450c-a26f-64e322730fef", "building": null, "createdAt": "2026-03-09T16:04:54.650Z", "unitNumber": "NEW", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-09 16:04:54.654224
ab215280-fe88-48aa-8bc5-931ed2e5c810	admin@local	create	person	172f12c5-ee42-4f89-90bc-c264c4c3c17d	\N	\N	{"id": "172f12c5-ee42-4f89-90bc-c264c4c3c17d", "email": null, "phone": null, "lastName": "Ave", "createdAt": "2026-03-09T16:04:54.666Z", "firstName": "1415 Quinnipiac", "mailingAddress": "CT  06513"}	2026-03-09 16:04:54.669559
ad21fc19-c09f-46c2-8928-65ebe53fe7fb	admin@local	create	ownership	3a617c77-d116-4435-9e85-5d5606ec570d	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "3a617c77-d116-4435-9e85-5d5606ec570d", "unitId": "f589dc59-4725-450c-a26f-64e322730fef", "endDate": null, "personId": "172f12c5-ee42-4f89-90bc-c264c4c3c17d", "startDate": "2026-03-09T16:04:54.673Z", "ownershipPercentage": 100}	2026-03-09 16:04:54.676557
daab44fe-b4b7-4bdd-9d5e-541822eabfe9	admin@local	create	unit	827e521c-9f12-4dfe-99d3-eb66788ddcb8	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "827e521c-9f12-4dfe-99d3-eb66788ddcb8", "building": null, "createdAt": "2026-03-09T16:04:54.679Z", "unitNumber": "NSOFOR", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-09 16:04:54.69198
4ac93309-a73b-4df7-8ba8-aa8d404f309f	admin@local	create	person	6bc0b97d-8122-4606-b9df-c47178bd5477	\N	\N	{"id": "6bc0b97d-8122-4606-b9df-c47178bd5477", "email": "rnsofor@yahoo.com", "phone": "203-469-1363", "lastName": "Unknown", "createdAt": "2026-03-09T16:04:54.694Z", "firstName": "A", "mailingAddress": null}	2026-03-09 16:04:54.69764
8b49344c-9fbd-44b9-b7bd-59fcac8743dc	admin@local	create	ownership	edd6c8e4-4ff6-48db-b5fc-9a821fe864ab	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "edd6c8e4-4ff6-48db-b5fc-9a821fe864ab", "unitId": "827e521c-9f12-4dfe-99d3-eb66788ddcb8", "endDate": null, "personId": "6bc0b97d-8122-4606-b9df-c47178bd5477", "startDate": "2026-03-09T16:04:54.700Z", "ownershipPercentage": 100}	2026-03-09 16:04:54.704932
e5408184-6c26-46c7-98bb-c6a7134220fa	admin@local	create	unit	bd2d0f10-a8ad-4328-8c9b-d8c7ac878e7a	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "bd2d0f10-a8ad-4328-8c9b-d8c7ac878e7a", "building": null, "createdAt": "2026-03-09T16:04:54.707Z", "unitNumber": "GLORIA", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-09 16:04:54.711204
bef05e84-f167-48a1-9dae-5e61d549e91d	admin@local	create	person	f9f69aa8-cf83-4a49-841b-9885b2c8043d	\N	\N	{"id": "f9f69aa8-cf83-4a49-841b-9885b2c8043d", "email": "gachigasim@gmail.com", "phone": "203-209-3642", "lastName": "Unknown", "createdAt": "2026-03-09T16:04:54.714Z", "firstName": "B", "mailingAddress": null}	2026-03-09 16:04:54.716675
fc305bf0-fccd-4ddd-94b1-a835155d5291	admin@local	create	ownership	8fb4d370-a4d2-46a6-9b2f-2c50641cb927	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "8fb4d370-a4d2-46a6-9b2f-2c50641cb927", "unitId": "bd2d0f10-a8ad-4328-8c9b-d8c7ac878e7a", "endDate": null, "personId": "f9f69aa8-cf83-4a49-841b-9885b2c8043d", "startDate": "2026-03-09T16:04:54.719Z", "ownershipPercentage": 100}	2026-03-09 16:04:54.723297
fcfeec57-f848-421c-a58e-68482056d527	admin@local	create	unit	b4447a9e-d0e1-4b0e-9619-4c40f2b86a87	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "b4447a9e-d0e1-4b0e-9619-4c40f2b86a87", "building": null, "createdAt": "2026-03-09T16:04:54.726Z", "unitNumber": "JOSE", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-09 16:04:54.729202
8cec52eb-c064-4b2a-a8f9-3ee94bff1fc9	admin@local	create	person	9b9f4306-666e-4fdc-921b-b4b3c6444a06	\N	\N	{"id": "9b9f4306-666e-4fdc-921b-b4b3c6444a06", "email": "joseomarsanchez77@gmail.com", "phone": "203-535-4821", "lastName": "Unknown", "createdAt": "2026-03-09T16:04:54.731Z", "firstName": "C", "mailingAddress": null}	2026-03-09 16:04:54.734337
8f11276e-8c24-4e7c-82dc-a37c72ad24db	admin@local	create	ownership	a26ef2e1-9abb-47cf-87f3-c42e5585646c	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "a26ef2e1-9abb-47cf-87f3-c42e5585646c", "unitId": "b4447a9e-d0e1-4b0e-9619-4c40f2b86a87", "endDate": null, "personId": "9b9f4306-666e-4fdc-921b-b4b3c6444a06", "startDate": "2026-03-09T16:04:54.737Z", "ownershipPercentage": 100}	2026-03-09 16:04:54.74158
69e81e97-2146-4d2d-afeb-91824b77839d	admin@local	create	person	f5d419d2-ffde-4803-a921-405a0355b5ba	\N	\N	{"id": "f5d419d2-ffde-4803-a921-405a0355b5ba", "email": null, "phone": null, "lastName": "Ave", "createdAt": "2026-03-09T16:04:54.744Z", "firstName": "1417 Quinnipiac", "mailingAddress": "CT  06513"}	2026-03-09 16:04:54.74704
ca28156e-58af-4922-aa65-7338cd365922	admin@local	create	ownership	9734fc3d-7b86-416e-ae3a-a84f83bfa672	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "9734fc3d-7b86-416e-ae3a-a84f83bfa672", "unitId": "f589dc59-4725-450c-a26f-64e322730fef", "endDate": null, "personId": "f5d419d2-ffde-4803-a921-405a0355b5ba", "startDate": "2026-03-09T16:04:54.749Z", "ownershipPercentage": 100}	2026-03-09 16:04:54.753512
6db742e0-6a4a-4c36-834a-9f143e2d0ba6	admin@local	create	unit	a9688d9b-1ce6-4f86-8e7b-2f6c43ca9f89	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "a9688d9b-1ce6-4f86-8e7b-2f6c43ca9f89", "building": null, "createdAt": "2026-03-09T16:04:54.756Z", "unitNumber": "PETER", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-09 16:04:54.75941
459fdf23-517b-4147-9d17-5e382053947a	admin@local	create	ownership	29c1539c-7de4-4189-ae7f-7b32b12a092b	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "29c1539c-7de4-4189-ae7f-7b32b12a092b", "unitId": "a9688d9b-1ce6-4f86-8e7b-2f6c43ca9f89", "endDate": null, "personId": "6bc0b97d-8122-4606-b9df-c47178bd5477", "startDate": "2026-03-09T16:04:54.762Z", "ownershipPercentage": 100}	2026-03-09 16:04:54.766185
bec29f57-76e5-44b5-8850-392a81698a68	admin@local	create	unit	6f753eaa-8f4b-43ab-8567-5e128a6cda77	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "6f753eaa-8f4b-43ab-8567-5e128a6cda77", "building": null, "createdAt": "2026-03-09T16:04:54.769Z", "unitNumber": "PRISCILLA", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-09 16:04:54.771519
4b458420-2c2a-4f8c-b9e8-fdecb5a808b7	admin@local	update	person	f9f69aa8-cf83-4a49-841b-9885b2c8043d	\N	{"id": "f9f69aa8-cf83-4a49-841b-9885b2c8043d", "email": "gachigasim@gmail.com", "phone": "203-209-3642", "lastName": "Unknown", "createdAt": "2026-03-09T16:04:54.714Z", "firstName": "B", "mailingAddress": null}	{"id": "f9f69aa8-cf83-4a49-841b-9885b2c8043d", "email": "gachigasim@gmail.com", "phone": "203-209-3642", "lastName": "Unknown", "createdAt": "2026-03-09T16:04:54.714Z", "firstName": "B", "mailingAddress": "`"}	2026-03-09 16:04:54.77828
a3bdc63a-2896-44be-b078-d6c985a0188b	admin@local	create	ownership	0e586649-9ee2-4d9f-995d-bda505cca483	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "0e586649-9ee2-4d9f-995d-bda505cca483", "unitId": "6f753eaa-8f4b-43ab-8567-5e128a6cda77", "endDate": null, "personId": "f9f69aa8-cf83-4a49-841b-9885b2c8043d", "startDate": "2026-03-09T16:04:54.781Z", "ownershipPercentage": 100}	2026-03-09 16:04:54.785808
a2c12ae0-bc42-4054-94b4-9c54368694b6	admin@local	create	unit	8d85fdb3-8a18-48d0-b7a7-9c0a4bb7c10f	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "8d85fdb3-8a18-48d0-b7a7-9c0a4bb7c10f", "building": null, "createdAt": "2026-03-09T16:04:54.788Z", "unitNumber": "FELIPE", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-09 16:04:54.79115
9e667525-38a0-4ddc-a18f-fad8941e5a42	admin@local	create	ownership	5ede2040-6535-483a-a4d8-ec455f29bb4e	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "5ede2040-6535-483a-a4d8-ec455f29bb4e", "unitId": "8d85fdb3-8a18-48d0-b7a7-9c0a4bb7c10f", "endDate": null, "personId": "9b9f4306-666e-4fdc-921b-b4b3c6444a06", "startDate": "2026-03-09T16:04:54.793Z", "ownershipPercentage": 100}	2026-03-09 16:04:54.797268
41b9fb97-89d3-4cbc-8e1a-42f4fe9d3971	admin@local	create	unit	e885ccf6-45a9-41b0-9fd0-5eebfd5d7673	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "e885ccf6-45a9-41b0-9fd0-5eebfd5d7673", "building": null, "createdAt": "2026-03-09T16:04:54.800Z", "unitNumber": "CATHERINE", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-09 16:04:54.80319
4e61144f-e53a-40bc-8219-1432e1475b29	admin@local	create	person	0f7d7938-c9eb-4daf-a605-26913c33a080	\N	\N	{"id": "0f7d7938-c9eb-4daf-a605-26913c33a080", "email": "fanningcatherine@hotmail.com", "phone": "203-214-1944", "lastName": "Unknown", "createdAt": "2026-03-09T16:04:54.805Z", "firstName": "D", "mailingAddress": null}	2026-03-09 16:04:54.808935
f549a3e7-1239-43c5-95b2-eed9d04d6a2a	admin@local	create	ownership	98b023fa-94e2-425d-893f-24aee2906ae7	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "98b023fa-94e2-425d-893f-24aee2906ae7", "unitId": "e885ccf6-45a9-41b0-9fd0-5eebfd5d7673", "endDate": null, "personId": "0f7d7938-c9eb-4daf-a605-26913c33a080", "startDate": "2026-03-09T16:04:54.812Z", "ownershipPercentage": 100}	2026-03-09 16:04:54.816493
79e1cb0e-2c22-4cd4-a2aa-1dc1dc4bf30b	admin@local	create	unit	2e28a66f-8357-4fc6-9f88-45470c27b5d9	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "2e28a66f-8357-4fc6-9f88-45470c27b5d9", "building": null, "createdAt": "2026-03-09T16:04:54.818Z", "unitNumber": "MARY", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-09 16:04:54.821459
4caaba4d-648f-4674-b76f-a6ebbbd0488b	admin@local	create	person	ed84f0f0-b6e6-49c2-a056-74bd9e7d450e	\N	\N	{"id": "ed84f0f0-b6e6-49c2-a056-74bd9e7d450e", "email": "fuquana.heyward@yahoo.com", "phone": "2035898864", "lastName": "Unknown", "createdAt": "2026-03-09T16:04:54.824Z", "firstName": "E", "mailingAddress": null}	2026-03-09 16:04:54.827196
16572d5c-0247-4d26-bec8-2c20d1e2f1aa	admin@local	create	ownership	9f17666d-ef50-41fa-bde6-1d6c26a9c46c	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "9f17666d-ef50-41fa-bde6-1d6c26a9c46c", "unitId": "2e28a66f-8357-4fc6-9f88-45470c27b5d9", "endDate": null, "personId": "ed84f0f0-b6e6-49c2-a056-74bd9e7d450e", "startDate": "2026-03-09T16:04:54.830Z", "ownershipPercentage": 100}	2026-03-09 16:04:54.834127
5b0ea6b6-2378-49fa-84fb-46a448d474ed	admin@local	create	unit	791114a0-6fad-49f7-ad85-4663b00f4f6e	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "791114a0-6fad-49f7-ad85-4663b00f4f6e", "building": null, "createdAt": "2026-03-09T16:04:54.837Z", "unitNumber": "WILLIAM", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-09 16:04:54.839267
3581a9b1-aef2-4dce-b322-581a8f59508e	admin@local	create	person	283bcf8c-2e1a-4bca-b176-bbfbed0f4ccb	\N	\N	{"id": "283bcf8c-2e1a-4bca-b176-bbfbed0f4ccb", "email": "williamruiz11@gmail.com", "phone": "203-676-4815", "lastName": "Unknown", "createdAt": "2026-03-09T16:04:54.842Z", "firstName": "F", "mailingAddress": null}	2026-03-09 16:04:54.844909
623f3ecc-cd2b-4286-88ea-155be297c04b	admin@local	create	ownership	119c3363-be4d-4f74-be9f-551831a3991f	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "119c3363-be4d-4f74-be9f-551831a3991f", "unitId": "791114a0-6fad-49f7-ad85-4663b00f4f6e", "endDate": null, "personId": "283bcf8c-2e1a-4bca-b176-bbfbed0f4ccb", "startDate": "2026-03-09T16:04:54.847Z", "ownershipPercentage": 100}	2026-03-09 16:04:54.850783
2e5202b4-a344-4588-ac99-93b6088fe302	admin@local	create	unit	88c87027-f2cf-4f3e-9c31-5e328f5a5fcd	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "88c87027-f2cf-4f3e-9c31-5e328f5a5fcd", "building": null, "createdAt": "2026-03-09T16:04:54.853Z", "unitNumber": "DIANE", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-09 16:04:54.856442
2acb845f-7984-4646-8de4-5b1046c70d6f	admin@local	create	person	802a3702-58d9-4361-b52e-fc5f9143a577	\N	\N	{"id": "802a3702-58d9-4361-b52e-fc5f9143a577", "email": "dhtorok@comcast.net", "phone": "203-400-4943", "lastName": "Unknown", "createdAt": "2026-03-09T16:04:54.858Z", "firstName": "G", "mailingAddress": null}	2026-03-09 16:04:54.861789
2b5255db-4938-45da-ba57-469e3c294af8	admin@local	create	ownership	670ab121-1dc1-4bea-8ffe-7d86f133e393	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "670ab121-1dc1-4bea-8ffe-7d86f133e393", "unitId": "88c87027-f2cf-4f3e-9c31-5e328f5a5fcd", "endDate": null, "personId": "802a3702-58d9-4361-b52e-fc5f9143a577", "startDate": "2026-03-09T16:04:54.864Z", "ownershipPercentage": 100}	2026-03-09 16:04:54.868098
67a4cde4-70d9-403f-b900-d5af4a55c1bf	admin@local	create	person	b1df62de-9534-47a7-8423-ac3a696087c5	\N	\N	{"id": "b1df62de-9534-47a7-8423-ac3a696087c5", "email": null, "phone": null, "lastName": "Ave", "createdAt": "2026-03-09T16:04:54.870Z", "firstName": "1419 Quinnipiac", "mailingAddress": "CT  06513"}	2026-03-09 16:04:54.873036
e686578f-5c69-4f9b-8d24-467607459fd8	admin@local	create	ownership	5170445a-d189-4b0c-b380-b8d7dbe1f8f6	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "5170445a-d189-4b0c-b380-b8d7dbe1f8f6", "unitId": "f589dc59-4725-450c-a26f-64e322730fef", "endDate": null, "personId": "b1df62de-9534-47a7-8423-ac3a696087c5", "startDate": "2026-03-09T16:04:54.875Z", "ownershipPercentage": 100}	2026-03-09 16:04:54.88017
5680ad9f-d947-4fff-8f7d-ade94e7ab20f	admin@local	create	unit	5cd51a04-9dc4-4efc-a0dc-65a8b1692e35	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "5cd51a04-9dc4-4efc-a0dc-65a8b1692e35", "building": null, "createdAt": "2026-03-09T16:04:54.882Z", "unitNumber": "TILLMAN", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-09 16:04:54.885535
4e4586ac-aabd-4c45-8d07-3a6cca840507	admin@local	create	person	24aeb79d-5675-4955-a038-959a82b833ef	\N	\N	{"id": "24aeb79d-5675-4955-a038-959a82b833ef", "email": "lestertillman@hotmail.com", "phone": "203-823-5557", "lastName": "Family", "createdAt": "2026-03-09T16:04:54.888Z", "firstName": "1", "mailingAddress": null}	2026-03-09 16:04:54.891028
495070a2-364b-4a11-bc37-5014b941b93f	admin@local	create	ownership	87154b3a-d676-4327-addb-31762a610a0d	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "87154b3a-d676-4327-addb-31762a610a0d", "unitId": "5cd51a04-9dc4-4efc-a0dc-65a8b1692e35", "endDate": null, "personId": "24aeb79d-5675-4955-a038-959a82b833ef", "startDate": "2026-03-09T16:04:54.893Z", "ownershipPercentage": 100}	2026-03-09 16:04:54.896425
c1ea5be3-2786-44b4-87c4-0351b5ae42a8	admin@local	create	person	a7e1aeaf-80f0-4259-ae24-166cae2e9a79	\N	\N	{"id": "a7e1aeaf-80f0-4259-ae24-166cae2e9a79", "email": null, "phone": null, "lastName": "Ave", "createdAt": "2026-03-09T16:04:54.898Z", "firstName": "1421 Quinnipiac", "mailingAddress": "CT  06513"}	2026-03-09 16:04:54.901577
660f9864-70d5-4eb8-a4e4-e91b68422bf2	admin@local	create	ownership	26ee35ab-2e9b-4f7d-9e04-30b47ea792e6	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "26ee35ab-2e9b-4f7d-9e04-30b47ea792e6", "unitId": "f589dc59-4725-450c-a26f-64e322730fef", "endDate": null, "personId": "a7e1aeaf-80f0-4259-ae24-166cae2e9a79", "startDate": "2026-03-09T16:04:54.904Z", "ownershipPercentage": 100}	2026-03-09 16:04:54.907572
234d44c9-466b-459d-a9b3-06d92d6009cf	admin@local	create	unit	9240cc99-0245-434b-b25b-2d834771373c	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "9240cc99-0245-434b-b25b-2d834771373c", "building": null, "createdAt": "2026-03-09T16:04:54.910Z", "unitNumber": "ANDREW", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-09 16:04:54.912704
09edf85e-68be-48d9-a295-487d80d36746	admin@local	create	ownership	0288bb21-155d-400e-87e7-b79c0803f800	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "0288bb21-155d-400e-87e7-b79c0803f800", "unitId": "9240cc99-0245-434b-b25b-2d834771373c", "endDate": null, "personId": "6bc0b97d-8122-4606-b9df-c47178bd5477", "startDate": "2026-03-09T16:04:54.915Z", "ownershipPercentage": 100}	2026-03-09 16:04:54.919004
130ff033-41ca-4947-9786-75e936a1a8f5	admin@local	create	ownership	7c549e10-846d-4e91-9150-88729adb45f0	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "7c549e10-846d-4e91-9150-88729adb45f0", "unitId": "791114a0-6fad-49f7-ad85-4663b00f4f6e", "endDate": null, "personId": "f9f69aa8-cf83-4a49-841b-9885b2c8043d", "startDate": "2026-03-09T16:04:54.921Z", "ownershipPercentage": 100}	2026-03-09 16:04:54.925352
0041bbbe-8422-4181-9158-9d5174919373	admin@local	create	ownership	2f7282a3-a11e-407d-8dfd-8913053f6f57	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "2f7282a3-a11e-407d-8dfd-8913053f6f57", "unitId": "791114a0-6fad-49f7-ad85-4663b00f4f6e", "endDate": null, "personId": "9b9f4306-666e-4fdc-921b-b4b3c6444a06", "startDate": "2026-03-09T16:04:54.928Z", "ownershipPercentage": 100}	2026-03-09 16:04:54.931747
081d5849-0825-4033-bb43-8d4bf035d27b	admin@local	create	ownership	afa3c5df-43eb-434b-896e-1cbf3710f528	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "afa3c5df-43eb-434b-896e-1cbf3710f528", "unitId": "8d85fdb3-8a18-48d0-b7a7-9c0a4bb7c10f", "endDate": null, "personId": "0f7d7938-c9eb-4daf-a605-26913c33a080", "startDate": "2026-03-09T16:04:54.934Z", "ownershipPercentage": 100}	2026-03-09 16:04:54.937772
f1e7ec00-a7d7-4534-b576-a33ddf0306f9	admin@local	create	unit	46db6480-f97d-4832-89f9-90ba595c8578	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "46db6480-f97d-4832-89f9-90ba595c8578", "building": null, "createdAt": "2026-03-09T16:04:54.940Z", "unitNumber": "THALIA", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-09 16:04:54.94272
05d7c335-ac24-4a49-a4db-2efc8793d17f	admin@local	create	ownership	15df84a9-a2a0-41e6-8c35-7677a9461778	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "15df84a9-a2a0-41e6-8c35-7677a9461778", "unitId": "46db6480-f97d-4832-89f9-90ba595c8578", "endDate": null, "personId": "ed84f0f0-b6e6-49c2-a056-74bd9e7d450e", "startDate": "2026-03-09T16:04:54.945Z", "ownershipPercentage": 100}	2026-03-09 16:04:54.948859
98ea794e-a44b-44fc-beaa-761d7388cc3f	admin@local	create	unit	7b2205b3-a0a4-4ff5-a660-980de53edb34	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "7b2205b3-a0a4-4ff5-a660-980de53edb34", "building": null, "createdAt": "2026-03-09T16:04:54.951Z", "unitNumber": "LORRAINE", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-09 16:04:54.953265
554570db-e4cb-4873-9f5f-c5b1c378aaf0	admin@local	create	ownership	25b27b4f-e461-419c-b169-5904fddef42b	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "25b27b4f-e461-419c-b169-5904fddef42b", "unitId": "7b2205b3-a0a4-4ff5-a660-980de53edb34", "endDate": null, "personId": "283bcf8c-2e1a-4bca-b176-bbfbed0f4ccb", "startDate": "2026-03-09T16:04:54.955Z", "ownershipPercentage": 100}	2026-03-09 16:04:54.958829
779e549d-96b1-42b6-994b-1c20cce918cd	admin@local	create	unit	2104baba-aac8-4f23-b212-80e2acb1cb1e	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "2104baba-aac8-4f23-b212-80e2acb1cb1e", "building": null, "createdAt": "2026-03-09T16:04:54.961Z", "unitNumber": "MAGEN", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-09 16:04:54.963754
5d0d279f-c911-4961-a687-e2df6b23af86	admin@local	create	ownership	e20b2615-5b96-43ed-8364-853b6c6cd846	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "e20b2615-5b96-43ed-8364-853b6c6cd846", "unitId": "2104baba-aac8-4f23-b212-80e2acb1cb1e", "endDate": null, "personId": "802a3702-58d9-4361-b52e-fc5f9143a577", "startDate": "2026-03-09T16:04:54.966Z", "ownershipPercentage": 100}	2026-03-09 16:04:54.969416
2694e477-d3f2-474f-988e-b97cc7a5508d	admin@local	update	association	e60c349e-b14e-48fa-a72e-8af3c2180c74	e60c349e-b14e-48fa-a72e-8af3c2180c74	{"id": "e60c349e-b14e-48fa-a72e-8af3c2180c74", "city": "Miami Beach", "name": "Sunset Towers", "state": "FL", "address": "1200 Ocean Drive", "country": "USA", "createdAt": "2026-03-06T16:20:53.680Z"}	{"id": "e60c349e-b14e-48fa-a72e-8af3c2180c74", "city": "Miami", "name": "Sunset Towers", "state": "FL", "address": "1200 Ocean Drive", "country": "USA", "createdAt": "2026-03-06T16:20:53.680Z"}	2026-03-10 18:29:52.648001
081fa306-e77e-4346-b580-96319f2d8fc7	qa@local	create	association	5d4488b7-c229-4412-8762-d822e4f150f3	5d4488b7-c229-4412-8762-d822e4f150f3	\N	{"id": "5d4488b7-c229-4412-8762-d822e4f150f3", "city": "New Haven", "name": "QA Communications Foundation 364067", "state": "CT", "address": "100 Verification Way", "country": "USA", "createdAt": "2026-03-11T14:12:44.087Z", "archivedAt": null, "isArchived": 0}	2026-03-11 14:12:44.134843
8ee2524d-5e96-475a-bd54-3d9ee6d45250	qa@local	create	unit	355b724f-3596-4565-8dfd-a5c9f4b5a9fb	5d4488b7-c229-4412-8762-d822e4f150f3	\N	{"id": "355b724f-3596-4565-8dfd-a5c9f4b5a9fb", "building": "A", "createdAt": "2026-03-11T14:12:44.141Z", "unitNumber": "QA-364067", "associationId": "5d4488b7-c229-4412-8762-d822e4f150f3", "squareFootage": 900}	2026-03-11 14:12:44.145287
5ee82014-2dfa-462e-8c1e-fef08c3522c7	system	create	occupancy	6dc1a27d-c73c-47e8-976b-d222fba075d8	5d4488b7-c229-4412-8762-d822e4f150f3	\N	{"id": "6dc1a27d-c73c-47e8-976b-d222fba075d8", "unitId": "355b724f-3596-4565-8dfd-a5c9f4b5a9fb", "endDate": null, "personId": "23a44250-f9b2-42a0-ba62-b3ef119a8f54", "startDate": "2026-03-11T14:12:44.148Z", "occupancyType": "OWNER_OCCUPIED"}	2026-03-11 14:12:44.166044
06c84330-f617-454c-817f-4da38fe2731e	system	create	ownership	00a8ed6f-7d34-4e97-b309-c779a31c85ca	5d4488b7-c229-4412-8762-d822e4f150f3	\N	{"id": "00a8ed6f-7d34-4e97-b309-c779a31c85ca", "unitId": "355b724f-3596-4565-8dfd-a5c9f4b5a9fb", "endDate": null, "personId": "23a44250-f9b2-42a0-ba62-b3ef119a8f54", "startDate": "2026-03-11T14:12:44.148Z", "ownershipPercentage": 100}	2026-03-11 14:12:44.176846
3eee129d-daf9-47a3-b88b-5144e7f4d256	qa-owner-364067@example.com	create	maintenance-request	aaef153e-cccc-48a6-a46c-343ebab567f3	5d4488b7-c229-4412-8762-d822e4f150f3	\N	{"id": "aaef153e-cccc-48a6-a46c-343ebab567f3", "title": "Urgent leak", "status": "submitted", "unitId": "355b724f-3596-4565-8dfd-a5c9f4b5a9fb", "category": "plumbing", "closedAt": null, "priority": "urgent", "createdAt": "2026-03-11T14:12:44.239Z", "triagedAt": null, "updatedAt": "2026-03-11T14:12:44.239Z", "assignedTo": null, "resolvedAt": null, "description": "Water leak in ceiling near bathroom vent.", "escalatedAt": null, "locationText": "Unit QA-364067", "associationId": "5d4488b7-c229-4412-8762-d822e4f150f3", "responseDueAt": "2026-03-11T18:12:44.239Z", "escalationStage": 0, "resolutionNotes": null, "submittedByEmail": "qa-owner-364067@example.com", "attachmentUrlsJson": [], "submittedByPersonId": "23a44250-f9b2-42a0-ba62-b3ef119a8f54", "lastEscalationNoticeAt": null, "submittedByPortalAccessId": null}	2026-03-11 14:12:44.247623
c79da9d7-f11f-4427-bc2e-451125b4c91e	qa-scheduler@local	update	maintenance-request-escalation	aaef153e-cccc-48a6-a46c-343ebab567f3	5d4488b7-c229-4412-8762-d822e4f150f3	{"id": "aaef153e-cccc-48a6-a46c-343ebab567f3", "title": "Urgent leak", "status": "submitted", "unitId": "355b724f-3596-4565-8dfd-a5c9f4b5a9fb", "category": "plumbing", "closedAt": null, "priority": "urgent", "createdAt": "2026-03-11T14:12:44.239Z", "triagedAt": null, "updatedAt": "2026-03-11T14:12:44.252Z", "assignedTo": null, "resolvedAt": null, "description": "Water leak in ceiling near bathroom vent.", "escalatedAt": null, "locationText": "Unit QA-364067", "associationId": "5d4488b7-c229-4412-8762-d822e4f150f3", "responseDueAt": "2026-03-11T13:12:44.252Z", "escalationStage": 0, "resolutionNotes": null, "submittedByEmail": "qa-owner-364067@example.com", "attachmentUrlsJson": [], "submittedByPersonId": "23a44250-f9b2-42a0-ba62-b3ef119a8f54", "lastEscalationNoticeAt": null, "submittedByPortalAccessId": null}	{"id": "aaef153e-cccc-48a6-a46c-343ebab567f3", "title": "Urgent leak", "status": "submitted", "unitId": "355b724f-3596-4565-8dfd-a5c9f4b5a9fb", "category": "plumbing", "closedAt": null, "priority": "urgent", "createdAt": "2026-03-11T14:12:44.239Z", "triagedAt": null, "updatedAt": "2026-03-11T14:12:44.255Z", "assignedTo": null, "resolvedAt": null, "description": "Water leak in ceiling near bathroom vent.", "escalatedAt": "2026-03-11T14:12:44.255Z", "locationText": "Unit QA-364067", "associationId": "5d4488b7-c229-4412-8762-d822e4f150f3", "responseDueAt": "2026-03-11T13:12:44.252Z", "escalationStage": 1, "resolutionNotes": null, "submittedByEmail": "qa-owner-364067@example.com", "attachmentUrlsJson": [], "submittedByPersonId": "23a44250-f9b2-42a0-ba62-b3ef119a8f54", "lastEscalationNoticeAt": "2026-03-11T14:12:44.255Z", "submittedByPortalAccessId": null}	2026-03-11 14:12:44.264732
753ca1e8-19f8-4160-a3e5-433c19ec37dd	automation@system	update	maintenance-request-escalation	aaef153e-cccc-48a6-a46c-343ebab567f3	5d4488b7-c229-4412-8762-d822e4f150f3	{"id": "aaef153e-cccc-48a6-a46c-343ebab567f3", "title": "Urgent leak", "status": "submitted", "unitId": "355b724f-3596-4565-8dfd-a5c9f4b5a9fb", "category": "plumbing", "closedAt": null, "priority": "urgent", "createdAt": "2026-03-11T14:12:44.239Z", "triagedAt": null, "updatedAt": "2026-03-11T14:12:44.255Z", "assignedTo": null, "resolvedAt": null, "description": "Water leak in ceiling near bathroom vent.", "escalatedAt": "2026-03-11T14:12:44.255Z", "locationText": "Unit QA-364067", "associationId": "5d4488b7-c229-4412-8762-d822e4f150f3", "responseDueAt": "2026-03-11T13:12:44.252Z", "escalationStage": 1, "resolutionNotes": null, "submittedByEmail": "qa-owner-364067@example.com", "attachmentUrlsJson": [], "submittedByPersonId": "23a44250-f9b2-42a0-ba62-b3ef119a8f54", "lastEscalationNoticeAt": "2026-03-11T14:12:44.255Z", "submittedByPortalAccessId": null}	{"id": "aaef153e-cccc-48a6-a46c-343ebab567f3", "title": "Urgent leak", "status": "submitted", "unitId": "355b724f-3596-4565-8dfd-a5c9f4b5a9fb", "category": "plumbing", "closedAt": null, "priority": "urgent", "createdAt": "2026-03-11T14:12:44.239Z", "triagedAt": null, "updatedAt": "2026-03-11T15:24:14.474Z", "assignedTo": null, "resolvedAt": null, "description": "Water leak in ceiling near bathroom vent.", "escalatedAt": "2026-03-11T15:24:14.474Z", "locationText": "Unit QA-364067", "associationId": "5d4488b7-c229-4412-8762-d822e4f150f3", "responseDueAt": "2026-03-11T13:12:44.252Z", "escalationStage": 2, "resolutionNotes": null, "submittedByEmail": "qa-owner-364067@example.com", "attachmentUrlsJson": [], "submittedByPersonId": "23a44250-f9b2-42a0-ba62-b3ef119a8f54", "lastEscalationNoticeAt": "2026-03-11T15:24:14.474Z", "submittedByPortalAccessId": null}	2026-03-11 15:24:15.135088
c842db52-305a-4477-91dc-c1028daf73b7	admin@local	update	association	f301d073-ed84-4d73-84ce-3ef28af66f7a	f301d073-ed84-4d73-84ce-3ef28af66f7a	{"id": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "city": "New Haven", "name": "Cherry Hill Court Condominiums", "state": "CT", "address": "1405 Quinnipiac Ave.", "country": "USA", "createdAt": "2026-03-07T17:15:42.394Z", "archivedAt": null, "isArchived": 0}	{"id": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "city": "New Haven", "name": "Cherry Hill Court Condominiums", "state": "CT", "address": "1405 Quinnipiac Ave.", "country": "USA", "createdAt": "2026-03-07T17:15:42.394Z", "archivedAt": null, "isArchived": 0}	2026-03-12 18:09:23.643989
0614400c-3bfc-470a-8400-590db50eac8f	automation@system	update	maintenance-request-escalation	aaef153e-cccc-48a6-a46c-343ebab567f3	5d4488b7-c229-4412-8762-d822e4f150f3	{"id": "aaef153e-cccc-48a6-a46c-343ebab567f3", "title": "Urgent leak", "status": "submitted", "unitId": "355b724f-3596-4565-8dfd-a5c9f4b5a9fb", "category": "plumbing", "closedAt": null, "priority": "urgent", "createdAt": "2026-03-11T14:12:44.239Z", "triagedAt": null, "updatedAt": "2026-03-11T15:24:14.474Z", "assignedTo": null, "resolvedAt": null, "description": "Water leak in ceiling near bathroom vent.", "escalatedAt": "2026-03-11T15:24:14.474Z", "locationText": "Unit QA-364067", "associationId": "5d4488b7-c229-4412-8762-d822e4f150f3", "responseDueAt": "2026-03-11T13:12:44.252Z", "escalationStage": 2, "resolutionNotes": null, "submittedByEmail": "qa-owner-364067@example.com", "attachmentUrlsJson": [], "submittedByPersonId": "23a44250-f9b2-42a0-ba62-b3ef119a8f54", "lastEscalationNoticeAt": "2026-03-11T15:24:14.474Z", "submittedByPortalAccessId": null}	{"id": "aaef153e-cccc-48a6-a46c-343ebab567f3", "title": "Urgent leak", "status": "submitted", "unitId": "355b724f-3596-4565-8dfd-a5c9f4b5a9fb", "category": "plumbing", "closedAt": null, "priority": "urgent", "createdAt": "2026-03-11T14:12:44.239Z", "triagedAt": null, "updatedAt": "2026-03-11T15:29:14.475Z", "assignedTo": null, "resolvedAt": null, "description": "Water leak in ceiling near bathroom vent.", "escalatedAt": "2026-03-11T15:29:14.475Z", "locationText": "Unit QA-364067", "associationId": "5d4488b7-c229-4412-8762-d822e4f150f3", "responseDueAt": "2026-03-11T13:12:44.252Z", "escalationStage": 3, "resolutionNotes": null, "submittedByEmail": "qa-owner-364067@example.com", "attachmentUrlsJson": [], "submittedByPersonId": "23a44250-f9b2-42a0-ba62-b3ef119a8f54", "lastEscalationNoticeAt": "2026-03-11T15:29:14.475Z", "submittedByPortalAccessId": null}	2026-03-11 15:29:14.502016
6474e1c1-4db1-490f-9793-1077bf0907f0	admin@local	create	unit	96696dfe-9feb-439a-ba29-88b79c5a74fd	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "96696dfe-9feb-439a-ba29-88b79c5a74fd", "building": "B", "createdAt": "2026-03-12T16:04:46.869Z", "unitNumber": "1421", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": 1200}	2026-03-12 16:04:47.322103
750fca51-5f65-4c50-872e-891694a6baab	admin@local	update	unit	96696dfe-9feb-439a-ba29-88b79c5a74fd	f301d073-ed84-4d73-84ce-3ef28af66f7a	{"id": "96696dfe-9feb-439a-ba29-88b79c5a74fd", "building": "B", "createdAt": "2026-03-12T16:04:46.869Z", "unitNumber": "1421", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": 1200}	{"id": "96696dfe-9feb-439a-ba29-88b79c5a74fd", "building": "1421", "createdAt": "2026-03-12T16:04:46.869Z", "unitNumber": "B", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": 1200}	2026-03-12 16:04:56.44595
7363d9ed-566d-4a6e-9c87-6293b954b983	admin@local	create	unit	bfa54c14-9fcd-4ed4-a810-61f193aa7d4b	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "bfa54c14-9fcd-4ed4-a810-61f193aa7d4b", "building": "1421", "createdAt": "2026-03-12T16:05:19.336Z", "unitNumber": "A", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": 1500}	2026-03-12 16:05:19.340986
49a9de8e-8547-45b3-b2de-d4f1a0a18fe1	admin@local	create	unit	16795e0e-2a66-4a5a-9977-0d93e7790c6e	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "16795e0e-2a66-4a5a-9977-0d93e7790c6e", "building": "1421", "createdAt": "2026-03-12T16:05:29.241Z", "unitNumber": "C", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": 1200}	2026-03-12 16:05:29.246006
2070e76e-bf3d-4144-b73a-3042336e13df	admin@local	create	unit	f5d74705-ef3d-439d-bf89-a2c1c2a17f34	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "f5d74705-ef3d-439d-bf89-a2c1c2a17f34", "building": "1421", "createdAt": "2026-03-12T16:05:38.971Z", "unitNumber": "D", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-12 16:05:38.975008
676a9acd-aad0-4bdb-92b6-a8d32aa00364	verify-building-first-092492@local	create	association	f61e4b10-01a3-4670-87b3-c2a7749b2958	f61e4b10-01a3-4670-87b3-c2a7749b2958	\N	{"id": "f61e4b10-01a3-4670-87b3-c2a7749b2958", "city": "Austin", "name": "Building First Verify A 092492", "state": "TX", "address": "100 Verify Way", "country": "USA", "createdAt": "2026-03-12T16:31:32.513Z", "archivedAt": null, "isArchived": 0}	2026-03-12 16:31:32.521589
555a44fa-bd72-439f-9163-8aa4d7333a0d	verify-building-first-092492@local	create	association	8c579997-ec38-4389-9e78-dbf34ba80947	8c579997-ec38-4389-9e78-dbf34ba80947	\N	{"id": "8c579997-ec38-4389-9e78-dbf34ba80947", "city": "Austin", "name": "Building First Verify B 092492", "state": "TX", "address": "200 Verify Way", "country": "USA", "createdAt": "2026-03-12T16:31:32.525Z", "archivedAt": null, "isArchived": 0}	2026-03-12 16:31:32.528563
09a5c5e4-5512-4749-9de4-b1b8bb85ae64	verify-building-first-092492@local	create	building	cb058638-da68-4b2b-b961-7bed993cc5e6	f61e4b10-01a3-4670-87b3-c2a7749b2958	\N	{"id": "cb058638-da68-4b2b-b961-7bed993cc5e6", "name": "Building-A-092492", "notes": "verification", "address": "100 Verify Way", "createdAt": "2026-03-12T16:31:32.532Z", "updatedAt": "2026-03-12T16:31:32.532Z", "totalUnits": 12, "associationId": "f61e4b10-01a3-4670-87b3-c2a7749b2958"}	2026-03-12 16:31:32.536238
56da9229-64c5-4da9-85e5-7385ce0489fd	verify-building-first-092492@local	create	building	54e1f380-db0a-4112-80d3-59c760e3687f	8c579997-ec38-4389-9e78-dbf34ba80947	\N	{"id": "54e1f380-db0a-4112-80d3-59c760e3687f", "name": "Building-B-092492", "notes": "verification", "address": "200 Verify Way", "createdAt": "2026-03-12T16:31:32.539Z", "updatedAt": "2026-03-12T16:31:32.539Z", "totalUnits": 6, "associationId": "8c579997-ec38-4389-9e78-dbf34ba80947"}	2026-03-12 16:31:32.542956
c7837fe0-8aff-4ef1-b05e-29d8d8ab05c5	verify-building-first-092492@local	create	unit	c3d299b7-60a1-4012-843b-69d70c1c1d10	f61e4b10-01a3-4670-87b3-c2a7749b2958	\N	{"id": "c3d299b7-60a1-4012-843b-69d70c1c1d10", "building": "Building-A-092492", "createdAt": "2026-03-12T16:31:32.549Z", "buildingId": "cb058638-da68-4b2b-b961-7bed993cc5e6", "unitNumber": "A-092492", "associationId": "f61e4b10-01a3-4670-87b3-c2a7749b2958", "squareFootage": 950}	2026-03-12 16:31:32.554093
9cafe34c-f2e7-48b4-82cf-baa1bfa92490	verify-building-first-092492@local	create	unit	4bceb699-2677-4289-8ce5-81f2af60597b	f61e4b10-01a3-4670-87b3-c2a7749b2958	\N	{"id": "4bceb699-2677-4289-8ce5-81f2af60597b", "building": "Legacy Tower", "createdAt": "2026-03-12T16:31:32.558Z", "buildingId": null, "unitNumber": "LEG-092492", "associationId": "f61e4b10-01a3-4670-87b3-c2a7749b2958", "squareFootage": 880}	2026-03-12 16:31:32.561553
dd83de27-7176-4e37-b1db-d881eb8d538c	verify-building-first-092492@local	update	unit	4bceb699-2677-4289-8ce5-81f2af60597b	f61e4b10-01a3-4670-87b3-c2a7749b2958	{"id": "4bceb699-2677-4289-8ce5-81f2af60597b", "building": "Legacy Tower", "createdAt": "2026-03-12T16:31:32.558Z", "buildingId": null, "unitNumber": "LEG-092492", "associationId": "f61e4b10-01a3-4670-87b3-c2a7749b2958", "squareFootage": 880}	{"id": "4bceb699-2677-4289-8ce5-81f2af60597b", "building": "Building-A-092492", "createdAt": "2026-03-12T16:31:32.558Z", "buildingId": "cb058638-da68-4b2b-b961-7bed993cc5e6", "unitNumber": "LEG-092492", "associationId": "f61e4b10-01a3-4670-87b3-c2a7749b2958", "squareFootage": 880}	2026-03-12 16:31:32.577701
8bf6b377-5a2a-483e-843e-8df9ad3e6a23	admin@local	update	association	f301d073-ed84-4d73-84ce-3ef28af66f7a	f301d073-ed84-4d73-84ce-3ef28af66f7a	{"id": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "city": "New Haven", "name": "Cherry Hill Court Condominiums", "state": "CT", "address": "1405 Quinnipiac Ave.", "country": "USA", "createdAt": "2026-03-07T17:15:42.394Z", "archivedAt": null, "isArchived": 0}	{"id": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "city": "New Haven", "name": "Cherry Hill Court Condominiums", "state": "CT", "address": "1405 Quinnipiac Ave.", "country": "USA", "createdAt": "2026-03-07T17:15:42.394Z", "archivedAt": null, "isArchived": 0}	2026-03-12 18:22:14.10872
c7896358-4b8a-4f10-8864-b77851b8245e	admin@local	update	association	f301d073-ed84-4d73-84ce-3ef28af66f7a	f301d073-ed84-4d73-84ce-3ef28af66f7a	{"id": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "city": "New Haven", "name": "Cherry Hill Court Condominiums", "state": "CT", "address": "1405 Quinnipiac Ave.", "country": "USA", "createdAt": "2026-03-07T17:15:42.394Z", "archivedAt": null, "isArchived": 0}	{"id": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "city": "New Haven", "name": "Cherry Hill Court Condominiums", "state": "CT", "address": "1405 Quinnipiac Ave.", "country": "USA", "createdAt": "2026-03-07T17:15:42.394Z", "archivedAt": null, "isArchived": 0}	2026-03-12 18:22:26.644472
612f7ffe-e691-4af8-a12a-adebf964f863	admin@local	update	association	f301d073-ed84-4d73-84ce-3ef28af66f7a	f301d073-ed84-4d73-84ce-3ef28af66f7a	{"id": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "ein": null, "city": "New Haven", "name": "Cherry Hill Court Condominiums", "state": "CT", "address": "1405 Quinnipiac Ave.", "country": "USA", "createdAt": "2026-03-07T17:15:42.394Z", "archivedAt": null, "dateFormed": null, "isArchived": 0, "associationType": null}	{"id": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "ein": "", "city": "New Haven", "name": "Cherry Hill Court Condominiums", "state": "CT", "address": "1405 Quinnipiac Ave.", "country": "USA", "createdAt": "2026-03-07T17:15:42.394Z", "archivedAt": null, "dateFormed": "1990-07-16", "isArchived": 0, "associationType": ""}	2026-03-12 20:07:58.76021
2a151b3c-485f-4a06-becb-bf898b7070b2	admin@local	create	building	f249583c-5d75-4865-a6ca-d01f0b4dd3a6	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "f249583c-5d75-4865-a6ca-d01f0b4dd3a6", "name": "1417", "notes": null, "address": "Quinnipiac Ave., New Haven, CT 06513", "createdAt": "2026-03-12T20:08:27.895Z", "updatedAt": "2026-03-12T20:08:27.895Z", "totalUnits": 7, "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a"}	2026-03-12 20:08:27.89972
2cfcfe57-50bf-4c0a-9b96-5cddf04e258c	admin@local	create	unit	34575428-ea77-4013-bd0f-593e0c7dbbbb	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "34575428-ea77-4013-bd0f-593e0c7dbbbb", "building": "1417", "createdAt": "2026-03-12T20:16:43.272Z", "buildingId": "f249583c-5d75-4865-a6ca-d01f0b4dd3a6", "unitNumber": "A", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-12 20:16:43.277501
6ecd90fa-137c-4477-ab96-910e2206c2c1	admin@local	create	unit	b1f60b15-3cec-4cca-8c1c-0a0ba7bf4d7f	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "b1f60b15-3cec-4cca-8c1c-0a0ba7bf4d7f", "building": "1417", "createdAt": "2026-03-12T20:17:14.746Z", "buildingId": "f249583c-5d75-4865-a6ca-d01f0b4dd3a6", "unitNumber": "B", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-12 20:17:14.779024
8eba733a-a0f6-45bc-9ccc-42d2c4cdf2fd	admin@local	create	unit	a5b46109-1514-4207-9ed3-2b587ead617f	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "a5b46109-1514-4207-9ed3-2b587ead617f", "building": "1417", "createdAt": "2026-03-14T14:32:33.169Z", "buildingId": "f249583c-5d75-4865-a6ca-d01f0b4dd3a6", "unitNumber": "C", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-14 14:32:33.173915
6b4230c4-0681-431f-9ef4-97f1e0cf0ef7	admin@local	create	unit	978bacef-824f-471e-80ea-891a8eaa01f8	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "978bacef-824f-471e-80ea-891a8eaa01f8", "building": "1417", "createdAt": "2026-03-14T14:32:41.054Z", "buildingId": "f249583c-5d75-4865-a6ca-d01f0b4dd3a6", "unitNumber": "D", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-14 14:32:41.058942
ba8825ef-1980-41a0-a991-f533f1bba5cb	admin@local	create	unit	3b5e2a2f-81cc-4199-9333-858c8f0fca9c	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "3b5e2a2f-81cc-4199-9333-858c8f0fca9c", "building": "1417", "createdAt": "2026-03-14T14:32:45.472Z", "buildingId": "f249583c-5d75-4865-a6ca-d01f0b4dd3a6", "unitNumber": "E", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-14 14:32:45.476609
e5fa8b64-4a92-4b18-b05f-da081aedc5b0	admin@local	create	unit	8b029a2d-c7e4-4cb1-ad82-9f9829877208	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "8b029a2d-c7e4-4cb1-ad82-9f9829877208", "building": "1417", "createdAt": "2026-03-14T14:32:48.539Z", "buildingId": "f249583c-5d75-4865-a6ca-d01f0b4dd3a6", "unitNumber": "F", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-14 14:32:48.543526
cead8c8f-7d89-476d-9e1f-74e9cc256a64	admin@local	create	unit	91e77ac7-b0dc-4bab-a169-f167b20e5cce	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "91e77ac7-b0dc-4bab-a169-f167b20e5cce", "building": "1417", "createdAt": "2026-03-14T14:32:51.224Z", "buildingId": "f249583c-5d75-4865-a6ca-d01f0b4dd3a6", "unitNumber": "G", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-14 14:32:51.227512
cfbe132b-0857-4859-ab0d-4814cf142398	admin@local	create	unit	3d308aff-6712-4628-b812-e247c38ab92b	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "3d308aff-6712-4628-b812-e247c38ab92b", "building": "1421", "createdAt": "2026-03-14T14:32:59.195Z", "buildingId": "e4f64f48-6136-457c-af87-20223cfc81ef", "unitNumber": "E", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-14 14:32:59.199074
474a9cc1-f10d-43fc-a3d8-d71bec0c75c6	admin@local	create	unit	968ed680-252a-4be9-ae77-9312e8a5a150	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "968ed680-252a-4be9-ae77-9312e8a5a150", "building": "1421", "createdAt": "2026-03-14T14:33:02.805Z", "buildingId": "e4f64f48-6136-457c-af87-20223cfc81ef", "unitNumber": "F", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-14 14:33:02.808548
1512883a-0173-435a-8453-c18e07e7f9c4	admin@local	create	unit	a1a7aef1-3b07-414c-ae6a-3093cf5105cd	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "a1a7aef1-3b07-414c-ae6a-3093cf5105cd", "building": "1421", "createdAt": "2026-03-14T14:33:05.929Z", "buildingId": "e4f64f48-6136-457c-af87-20223cfc81ef", "unitNumber": "G", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-14 14:33:05.932687
8db82755-cae1-4a2d-afa1-67e9e9979214	admin@local	create	building	b11ea5a8-d907-4063-a0ed-640874159f61	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "b11ea5a8-d907-4063-a0ed-640874159f61", "name": "1415", "notes": null, "address": "Quinnipiac Ave., New Haven, CT 06513", "createdAt": "2026-03-14T14:33:49.910Z", "updatedAt": "2026-03-14T14:33:49.910Z", "totalUnits": 1, "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a"}	2026-03-14 14:33:50.016497
e135a982-7fb4-43ce-b84b-434bda332a38	admin@local	create	unit	7adb3521-845b-41de-8054-3281ddfc0f3c	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "7adb3521-845b-41de-8054-3281ddfc0f3c", "building": "1415", "createdAt": "2026-03-14T14:37:34.228Z", "buildingId": "b11ea5a8-d907-4063-a0ed-640874159f61", "unitNumber": "A", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-14 14:37:34.233557
cd467bef-01cc-46a2-8cf4-423e2a807b38	admin@local	create	unit	909ed4e8-fb53-49f8-aecf-5b56c10e1e30	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "909ed4e8-fb53-49f8-aecf-5b56c10e1e30", "building": "1415", "createdAt": "2026-03-14T14:37:36.209Z", "buildingId": "b11ea5a8-d907-4063-a0ed-640874159f61", "unitNumber": "B", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-14 14:37:36.213425
4f719744-7bb5-440b-becc-163577ae771c	admin@local	create	unit	341b2050-28cf-4d3d-bc44-ef5a0f6584d9	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "341b2050-28cf-4d3d-bc44-ef5a0f6584d9", "building": "1415", "createdAt": "2026-03-14T14:37:40.808Z", "buildingId": "b11ea5a8-d907-4063-a0ed-640874159f61", "unitNumber": "C", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-14 14:37:40.812807
815cf2df-d1ea-4e3a-837e-31a6df98f820	admin@local	create	building	8a0fafb2-cc66-400f-a3dc-74617e39eefc	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "8a0fafb2-cc66-400f-a3dc-74617e39eefc", "name": "1419", "notes": null, "address": "Quinnipiac Ave., New Haven, CT 06513", "createdAt": "2026-03-14T14:38:11.444Z", "updatedAt": "2026-03-14T14:38:11.444Z", "totalUnits": 1, "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a"}	2026-03-14 14:38:11.450107
4e6e5427-6c69-469f-8131-2982151b2f02	admin@local	create	unit	a882cbbb-1061-4764-8b2b-d9398e2ccedb	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "a882cbbb-1061-4764-8b2b-d9398e2ccedb", "building": "1419", "createdAt": "2026-03-14T14:38:22.286Z", "buildingId": "8a0fafb2-cc66-400f-a3dc-74617e39eefc", "unitNumber": "1419", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-14 14:38:22.300853
77980660-ef78-4302-8291-a8126f60c00f	system	create	board-package	2f32bee5-2d07-4f1e-8b40-9e46863c4803	7a1f216a-8ac9-4fe9-a8d2-b62b01565a42	\N	{"id": "2f32bee5-2d07-4f1e-8b40-9e46863c4803", "title": "Automation Smoke Template 1773500707982 Package", "status": "draft", "createdAt": "2026-03-14T15:05:08.028Z", "meetingId": "b48b1ae0-c69b-4527-8f60-b4820721bb5a", "updatedAt": "2026-03-14T15:05:08.027Z", "templateId": "16abdba2-a1f5-4919-853b-8de0f2954c4e", "contentJson": [{"key": "financial", "items": ["Open receivables posted: 0.00", "Payments recorded: 0.00", "Budget count: 0"], "title": "Financial Summary"}, {"key": "governance", "items": ["Meetings tracked: 1", "Completed meetings: 0", "Published summaries: 0"], "title": "Governance Summary"}], "periodLabel": "board · 3/19/2026", "associationId": "7a1f216a-8ac9-4fe9-a8d2-b62b01565a42", "annotationsJson": []}	2026-03-14 15:05:08.032829
99730714-1bbc-4cdf-9585-4e560c1b671f	smoke@test	update	board-package-template-scheduled-generation	16abdba2-a1f5-4919-853b-8de0f2954c4e	7a1f216a-8ac9-4fe9-a8d2-b62b01565a42	{"id": "16abdba2-a1f5-4919-853b-8de0f2954c4e", "notes": "smoke", "title": "Automation Smoke Template 1773500707982", "createdAt": "2026-03-14T15:05:07.983Z", "frequency": "meeting-driven", "updatedAt": "2026-03-14T15:05:07.982Z", "meetingType": "board", "autoGenerate": 1, "sectionsJson": ["financial", "governance"], "associationId": "7a1f216a-8ac9-4fe9-a8d2-b62b01565a42", "generateDaysBefore": 7, "lastAutoGeneratedAt": null}	{"generatedCount": 1, "lastAutoGeneratedAt": "2026-03-14T15:05:07.965Z"}	2026-03-14 15:05:08.039129
d780686a-05e3-49b8-93bf-937884c5957e	verify-script	create	portal-access	436b0dc5-c7b8-4bd5-a032-8b968b961374	7c164b67-9e3b-456a-bb49-dd698b0822c4	\N	{"id": "436b0dc5-c7b8-4bd5-a032-8b968b961374", "role": "owner", "email": "owner.director.1773579706183@example.com", "status": "invited", "unitId": null, "personId": "6712c480-2344-4a2e-9c8b-c412861f9a31", "createdAt": "2026-03-15T13:01:46.292Z", "invitedAt": "2026-03-15T13:01:46.288Z", "invitedBy": "verify-script", "revokedAt": null, "updatedAt": "2026-03-15T13:01:46.292Z", "acceptedAt": null, "boardRoleId": "d0e858a6-95a9-4c6f-8c97-c6d60557d819", "lastLoginAt": null, "suspendedAt": null, "associationId": "7c164b67-9e3b-456a-bb49-dd698b0822c4"}	2026-03-15 13:01:46.29767
f7d2e896-0995-44e8-8fea-897acc0aea47	verify-script	create	portal-access	50c1d480-0f9b-4f32-a806-a587ae32f762	7c164b67-9e3b-456a-bb49-dd698b0822c4	\N	{"id": "50c1d480-0f9b-4f32-a806-a587ae32f762", "role": "board-member", "email": "board.only.1773579706183@example.com", "status": "invited", "unitId": null, "personId": "f9a59a1c-18da-427e-bee1-f01ecfbf5883", "createdAt": "2026-03-15T13:01:46.312Z", "invitedAt": "2026-03-15T13:01:46.309Z", "invitedBy": "verify-script", "revokedAt": null, "updatedAt": "2026-03-15T13:01:46.311Z", "acceptedAt": null, "boardRoleId": "4122602a-b023-40fb-98b6-ed68e8923ff6", "lastLoginAt": null, "suspendedAt": null, "associationId": "7c164b67-9e3b-456a-bb49-dd698b0822c4"}	2026-03-15 13:01:46.326625
133c658a-85b2-4599-b8e0-83169d0e2cbb	verify-script	update	portal-access	50c1d480-0f9b-4f32-a806-a587ae32f762	7c164b67-9e3b-456a-bb49-dd698b0822c4	{"id": "50c1d480-0f9b-4f32-a806-a587ae32f762", "role": "board-member", "email": "board.only.1773579706183@example.com", "status": "invited", "unitId": null, "personId": "f9a59a1c-18da-427e-bee1-f01ecfbf5883", "createdAt": "2026-03-15T13:01:46.312Z", "invitedAt": "2026-03-15T13:01:46.309Z", "invitedBy": "verify-script", "revokedAt": null, "updatedAt": "2026-03-15T13:01:46.311Z", "acceptedAt": null, "boardRoleId": "4122602a-b023-40fb-98b6-ed68e8923ff6", "lastLoginAt": null, "suspendedAt": null, "associationId": "7c164b67-9e3b-456a-bb49-dd698b0822c4"}	{"id": "50c1d480-0f9b-4f32-a806-a587ae32f762", "role": "board-member", "email": "board.only.1773579706183@example.com", "status": "active", "unitId": null, "personId": "f9a59a1c-18da-427e-bee1-f01ecfbf5883", "createdAt": "2026-03-15T13:01:46.312Z", "invitedAt": "2026-03-15T13:01:46.309Z", "invitedBy": "verify-script", "revokedAt": null, "updatedAt": "2026-03-15T13:01:46.332Z", "acceptedAt": "2026-03-15T13:01:46.332Z", "boardRoleId": "4122602a-b023-40fb-98b6-ed68e8923ff6", "lastLoginAt": null, "suspendedAt": null, "associationId": "7c164b67-9e3b-456a-bb49-dd698b0822c4"}	2026-03-15 13:01:46.337013
307f085a-8468-4d14-af2f-5a1ccffb570e	yourcondomanagement@gmail.com	create	document	57c9c8bd-2472-4521-9374-d70515b41b9b	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "57c9c8bd-2472-4521-9374-d70515b41b9b", "title": "CHC CT SOT Incorporation", "fileUrl": "/api/uploads/1773755295172-457800801.pdf", "createdAt": "2026-03-17T13:48:15.884Z", "uploadedBy": "William Ruiz", "documentType": "Legal", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "portalAudience": "owner", "isPortalVisible": 0}	2026-03-17 13:48:15.90425
5f4130cd-5d07-42fb-9634-8ffd2d818054	yourcondomanagement@gmail.com	create	document	1f844ff3-d406-493b-8b56-bd359d6d23df	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "1f844ff3-d406-493b-8b56-bd359d6d23df", "title": "CHC Declaration", "fileUrl": "/api/uploads/1773755335727-687250294.pdf", "createdAt": "2026-03-17T13:48:55.930Z", "uploadedBy": "William Ruiz", "documentType": "Legal", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "portalAudience": "owner", "isPortalVisible": 0}	2026-03-17 13:48:55.968185
b94122be-58c7-4079-abf0-3add83bb14dd	admin@local	update	association	f301d073-ed84-4d73-84ce-3ef28af66f7a	f301d073-ed84-4d73-84ce-3ef28af66f7a	{"id": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "ein": "", "city": "New Haven", "name": "Cherry Hill Court Condominiums", "state": "CT", "address": "1405 Quinnipiac Ave.", "country": "USA", "createdAt": "2026-03-07T17:15:42.394Z", "archivedAt": null, "dateFormed": "1990-07-16", "isArchived": 0, "associationType": ""}	{"id": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "ein": "", "city": "New Haven", "name": "Cherry Hill Court Condominiums", "state": "CT", "address": "1405 Quinnipiac Ave.", "country": "USA", "createdAt": "2026-03-07T17:15:42.394Z", "archivedAt": null, "dateFormed": "1990-07-16", "isArchived": 0, "associationType": ""}	2026-03-16 13:18:06.285802
55bc1fa7-fddb-4dae-97f5-f45334e4fb61	admin@local	update	admin-user-role	ae7a1d67-d01a-4041-ac39-68e1519ee77d	\N	{"role": "board-admin"}	{"role": "platform-admin", "reason": "because i said so"}	2026-03-16 16:04:32.888189
6c612f0d-3e91-4326-9447-ff3103923315	admin@local	create	document	dff4fe33-2ebb-4784-aeac-234a6a1050db	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "dff4fe33-2ebb-4784-aeac-234a6a1050db", "title": "CHC Bylaws", "fileUrl": "/api/uploads/1773680081933-729318237.pdf", "createdAt": "2026-03-16T16:54:42.406Z", "uploadedBy": "William Ruiz", "documentType": "Bylaws", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "portalAudience": "owner", "isPortalVisible": 0}	2026-03-16 16:54:42.584172
8453ae86-bd2c-483c-8998-9e046a6da4b9	admin@local	create	person	fe7e6966-711d-415d-b69e-724cad0e0ea4	\N	\N	{"id": "fe7e6966-711d-415d-b69e-724cad0e0ea4", "email": "williamruiz11@gmail.com", "phone": "2036764815", "lastName": "r", "createdAt": "2026-03-16T16:58:46.987Z", "firstName": "w", "mailingAddress": "10 Legend Lane, East Haven, Connecticut, United States", "contactPreference": "email", "emergencyContactName": null, "emergencyContactPhone": null}	2026-03-16 16:58:46.992931
fc99b595-bec2-474b-aff6-525ad6cf0d18	admin@local	create	person	8a431f1b-c1c4-414f-bdc3-5d5b446cd7e3	\N	\N	{"id": "8a431f1b-c1c4-414f-bdc3-5d5b446cd7e3", "email": "williamruiz11@gmail.com", "phone": "2036764815", "lastName": "r", "createdAt": "2026-03-16T17:01:22.475Z", "firstName": "w", "mailingAddress": "714 blackshire ", "contactPreference": "email", "emergencyContactName": null, "emergencyContactPhone": null}	2026-03-16 17:01:22.479547
c49fa51e-b304-4757-aeb9-8eae73c3b04b	admin@local	create	person	f49f0d4b-01fd-4ea3-b8be-2d70229eb549	\N	\N	{"id": "f49f0d4b-01fd-4ea3-b8be-2d70229eb549", "email": "williamruiz11@gmail.com", "phone": "2036764815", "lastName": "Ruiz", "createdAt": "2026-03-16T18:21:29.142Z", "firstName": "William", "mailingAddress": "714 Blackshire Road, Wilmington, Delaware, United States", "contactPreference": "email", "emergencyContactName": null, "emergencyContactPhone": null}	2026-03-16 18:21:29.146485
7817ada0-0edb-4d5f-9ed2-e4a6519dafda	admin@local	create	ownership	4593d79c-1100-41e5-ab04-c1430c710bc9	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "4593d79c-1100-41e5-ab04-c1430c710bc9", "unitId": "96696dfe-9feb-439a-ba29-88b79c5a74fd", "endDate": null, "personId": "f49f0d4b-01fd-4ea3-b8be-2d70229eb549", "startDate": "2026-03-16T18:21:29.196Z", "ownershipPercentage": 100}	2026-03-16 18:21:29.443601
28f1e601-539a-4fa7-b8cd-9b3586d803f7	admin@local	create	board-role	7efa2469-58dd-4ea2-91ac-4d15950bcc7d	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "7efa2469-58dd-4ea2-91ac-4d15950bcc7d", "role": "Board Member", "endDate": null, "personId": "f49f0d4b-01fd-4ea3-b8be-2d70229eb549", "startDate": "2026-03-04T00:00:00.000Z", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a"}	2026-03-16 18:21:50.403547
60cc10c5-b3f3-4a25-a2b7-d9c424dfe2d9	system	create	ownership	c0392b80-4776-4063-9867-1fb102b0fc56	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "c0392b80-4776-4063-9867-1fb102b0fc56", "unitId": "f5d74705-ef3d-439d-bf89-a2c1c2a17f34", "endDate": null, "personId": "e64948e9-e5e2-4504-aae3-3023701d7602", "startDate": "2017-06-01T00:00:00.000Z", "ownershipPercentage": 100}	2026-03-16 19:44:33.87691
2affd3d6-4d52-42de-871a-20e656419d24	system	create	portal-access	751e20ee-c8b9-4e2d-9ec4-7b716689617a	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "751e20ee-c8b9-4e2d-9ec4-7b716689617a", "role": "owner", "email": "minerva.miranda57@outlook.com", "status": "active", "unitId": "f5d74705-ef3d-439d-bf89-a2c1c2a17f34", "personId": "e64948e9-e5e2-4504-aae3-3023701d7602", "createdAt": "2026-03-16T19:44:33.885Z", "invitedAt": null, "invitedBy": null, "revokedAt": null, "updatedAt": "2026-03-16T19:44:33.885Z", "acceptedAt": "2026-03-16T19:44:33.885Z", "boardRoleId": null, "lastLoginAt": null, "suspendedAt": null, "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a"}	2026-03-16 19:44:33.893532
ccb768bd-0fdf-4580-a0b4-30c1181f8519	system	create	occupancy	46b12533-2da1-4410-9c84-94f081180df3	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "46b12533-2da1-4410-9c84-94f081180df3", "unitId": "f5d74705-ef3d-439d-bf89-a2c1c2a17f34", "endDate": null, "personId": "bc4206ca-98dc-4284-9493-b874420e4374", "startDate": "2017-06-01T00:00:00.000Z", "occupancyType": "TENANT"}	2026-03-16 19:44:33.912794
ea55c5ad-4aa7-4078-bde3-063a49953f0e	system	create	portal-access	ec96d695-f664-4b94-bbfd-e1fa140cd576	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "ec96d695-f664-4b94-bbfd-e1fa140cd576", "role": "tenant", "email": "terriyarbrough2415@gmail.com", "status": "active", "unitId": "f5d74705-ef3d-439d-bf89-a2c1c2a17f34", "personId": "bc4206ca-98dc-4284-9493-b874420e4374", "createdAt": "2026-03-16T19:44:33.920Z", "invitedAt": null, "invitedBy": null, "revokedAt": null, "updatedAt": "2026-03-16T19:44:33.919Z", "acceptedAt": "2026-03-16T19:44:33.919Z", "boardRoleId": null, "lastLoginAt": null, "suspendedAt": null, "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a"}	2026-03-16 19:44:33.922914
d2191090-94e2-4218-8a2d-484548a4b675	system	create	ownership	5edbcab0-1094-47eb-a635-882fade51019	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "5edbcab0-1094-47eb-a635-882fade51019", "unitId": "3d308aff-6712-4628-b812-e247c38ab92b", "endDate": null, "personId": "e64948e9-e5e2-4504-aae3-3023701d7602", "startDate": "2016-12-01T00:00:00.000Z", "ownershipPercentage": 100}	2026-03-16 20:18:39.541844
c883a71f-fc73-4bb8-8a4b-6ef5f1182730	system	update	portal-access	751e20ee-c8b9-4e2d-9ec4-7b716689617a	f301d073-ed84-4d73-84ce-3ef28af66f7a	{"id": "751e20ee-c8b9-4e2d-9ec4-7b716689617a", "role": "owner", "email": "minerva.miranda57@outlook.com", "status": "active", "unitId": "f5d74705-ef3d-439d-bf89-a2c1c2a17f34", "personId": "e64948e9-e5e2-4504-aae3-3023701d7602", "createdAt": "2026-03-16T19:44:33.885Z", "invitedAt": null, "invitedBy": null, "revokedAt": null, "updatedAt": "2026-03-16T19:44:33.885Z", "acceptedAt": "2026-03-16T19:44:33.885Z", "boardRoleId": null, "lastLoginAt": null, "suspendedAt": null, "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a"}	{"id": "751e20ee-c8b9-4e2d-9ec4-7b716689617a", "role": "owner", "email": "minerva.miranda57@outlook.com", "status": "active", "unitId": "3d308aff-6712-4628-b812-e247c38ab92b", "personId": "e64948e9-e5e2-4504-aae3-3023701d7602", "createdAt": "2026-03-16T19:44:33.885Z", "invitedAt": null, "invitedBy": null, "revokedAt": null, "updatedAt": "2026-03-16T20:18:39.550Z", "acceptedAt": "2026-03-16T19:44:33.885Z", "boardRoleId": null, "lastLoginAt": null, "suspendedAt": null, "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a"}	2026-03-16 20:18:39.556274
8276441d-904e-41e7-9e25-63b8fe5c97f8	system	create	occupancy	ef8df4e8-3f41-4d1e-b921-20567a8a18dd	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "ef8df4e8-3f41-4d1e-b921-20567a8a18dd", "unitId": "3d308aff-6712-4628-b812-e247c38ab92b", "endDate": null, "personId": "e64948e9-e5e2-4504-aae3-3023701d7602", "startDate": "2016-12-01T00:00:00.000Z", "occupancyType": "TENANT"}	2026-03-16 20:18:39.571987
cd16240a-6d25-40e1-9d07-3971bb304c12	system	update	portal-access	751e20ee-c8b9-4e2d-9ec4-7b716689617a	f301d073-ed84-4d73-84ce-3ef28af66f7a	{"id": "751e20ee-c8b9-4e2d-9ec4-7b716689617a", "role": "owner", "email": "minerva.miranda57@outlook.com", "status": "active", "unitId": "3d308aff-6712-4628-b812-e247c38ab92b", "personId": "e64948e9-e5e2-4504-aae3-3023701d7602", "createdAt": "2026-03-16T19:44:33.885Z", "invitedAt": null, "invitedBy": null, "revokedAt": null, "updatedAt": "2026-03-16T20:18:39.550Z", "acceptedAt": "2026-03-16T19:44:33.885Z", "boardRoleId": null, "lastLoginAt": null, "suspendedAt": null, "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a"}	{"id": "751e20ee-c8b9-4e2d-9ec4-7b716689617a", "role": "tenant", "email": "minerva.miranda57@outlook.com", "status": "active", "unitId": "3d308aff-6712-4628-b812-e247c38ab92b", "personId": "e64948e9-e5e2-4504-aae3-3023701d7602", "createdAt": "2026-03-16T19:44:33.885Z", "invitedAt": null, "invitedBy": null, "revokedAt": null, "updatedAt": "2026-03-16T20:18:39.583Z", "acceptedAt": "2026-03-16T19:44:33.885Z", "boardRoleId": null, "lastLoginAt": null, "suspendedAt": null, "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a"}	2026-03-16 20:18:39.58722
83d5ef59-9076-4ba5-bd27-8babd22ee9d6	system	create	ownership	63398896-4168-487b-9745-7c2f43a2af74	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "63398896-4168-487b-9745-7c2f43a2af74", "unitId": "a5b46109-1514-4207-9ed3-2b587ead617f", "endDate": null, "personId": "e64948e9-e5e2-4504-aae3-3023701d7602", "startDate": "2021-11-30T00:00:00.000Z", "ownershipPercentage": 100}	2026-03-16 20:18:40.838252
55e1280b-7798-484e-8156-5245e88d6acd	system	update	portal-access	751e20ee-c8b9-4e2d-9ec4-7b716689617a	f301d073-ed84-4d73-84ce-3ef28af66f7a	{"id": "751e20ee-c8b9-4e2d-9ec4-7b716689617a", "role": "tenant", "email": "minerva.miranda57@outlook.com", "status": "active", "unitId": "3d308aff-6712-4628-b812-e247c38ab92b", "personId": "e64948e9-e5e2-4504-aae3-3023701d7602", "createdAt": "2026-03-16T19:44:33.885Z", "invitedAt": null, "invitedBy": null, "revokedAt": null, "updatedAt": "2026-03-16T20:18:39.583Z", "acceptedAt": "2026-03-16T19:44:33.885Z", "boardRoleId": null, "lastLoginAt": null, "suspendedAt": null, "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a"}	{"id": "751e20ee-c8b9-4e2d-9ec4-7b716689617a", "role": "owner", "email": "minerva.miranda57@outlook.com", "status": "active", "unitId": "a5b46109-1514-4207-9ed3-2b587ead617f", "personId": "e64948e9-e5e2-4504-aae3-3023701d7602", "createdAt": "2026-03-16T19:44:33.885Z", "invitedAt": null, "invitedBy": null, "revokedAt": null, "updatedAt": "2026-03-16T20:18:40.844Z", "acceptedAt": "2026-03-16T19:44:33.885Z", "boardRoleId": null, "lastLoginAt": null, "suspendedAt": null, "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a"}	2026-03-16 20:18:40.847593
1e2bbc8a-d47d-43b7-b618-214bc76a9c74	system	create	occupancy	14887307-beef-4fbf-97e5-fa6b1f305072	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "14887307-beef-4fbf-97e5-fa6b1f305072", "unitId": "a5b46109-1514-4207-9ed3-2b587ead617f", "endDate": null, "personId": "c20a508c-c0a1-42dc-8bee-4c7afd45d117", "startDate": "2021-11-30T00:00:00.000Z", "occupancyType": "TENANT"}	2026-03-16 20:18:40.863804
26d604b3-9c5e-4e2c-84cf-0afdeecab581	system	create	portal-access	1fd1e704-557d-4212-81dd-940816d9f56d	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "1fd1e704-557d-4212-81dd-940816d9f56d", "role": "tenant", "email": "minerva.miranda57@outloo.com", "status": "active", "unitId": "a5b46109-1514-4207-9ed3-2b587ead617f", "personId": "c20a508c-c0a1-42dc-8bee-4c7afd45d117", "createdAt": "2026-03-16T20:18:40.870Z", "invitedAt": null, "invitedBy": null, "revokedAt": null, "updatedAt": "2026-03-16T20:18:40.870Z", "acceptedAt": "2026-03-16T20:18:40.870Z", "boardRoleId": null, "lastLoginAt": null, "suspendedAt": null, "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a"}	2026-03-16 20:18:40.873473
4c3cc4c6-494f-4f50-805c-e8ec7fb0f7ee	admin@local	update	person	c20a508c-c0a1-42dc-8bee-4c7afd45d117	\N	{"id": "c20a508c-c0a1-42dc-8bee-4c7afd45d117", "email": "Minerva.miranda57@outloo.com", "phone": "203-645-1457", "lastName": "Richards", "createdAt": "2026-03-16T20:18:40.852Z", "firstName": "Audrey", "mailingAddress": null, "contactPreference": "email", "emergencyContactName": null, "emergencyContactPhone": null}	{"id": "c20a508c-c0a1-42dc-8bee-4c7afd45d117", "email": "Minerva.miranda57@outlook.com", "phone": "203-645-1457", "lastName": "Richards", "createdAt": "2026-03-16T20:18:40.852Z", "firstName": "Audrey", "mailingAddress": null, "contactPreference": "email", "emergencyContactName": null, "emergencyContactPhone": null}	2026-03-16 20:34:38.740152
a40ba199-2f05-4ec5-b0cf-902c72bd94a4	admin@local	update	unit	3d308aff-6712-4628-b812-e247c38ab92b	f301d073-ed84-4d73-84ce-3ef28af66f7a	{"id": "3d308aff-6712-4628-b812-e247c38ab92b", "building": "1421", "createdAt": "2026-03-14T14:32:59.195Z", "buildingId": "e4f64f48-6136-457c-af87-20223cfc81ef", "unitNumber": "E", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	{"id": "3d308aff-6712-4628-b812-e247c38ab92b", "building": "1421", "createdAt": "2026-03-14T14:32:59.195Z", "buildingId": "e4f64f48-6136-457c-af87-20223cfc81ef", "unitNumber": "E", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-16 20:46:07.149724
59d33ba7-6233-4ed1-89f2-c244ec425d2d	system	create	ownership	29855825-d70f-4663-bd43-832a5ddde56c	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "29855825-d70f-4663-bd43-832a5ddde56c", "unitId": "341b2050-28cf-4d3d-bc44-ef5a0f6584d9", "endDate": null, "personId": "5dd27a32-c1ee-4826-bf18-db9df778eea3", "startDate": "2010-07-10T00:00:00.000Z", "ownershipPercentage": 100}	2026-03-16 22:52:54.449696
eba81e93-b02a-425b-b545-99e08f11fdfd	system	create	occupancy	85d231e4-2f3d-4699-9147-760056adfa75	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "85d231e4-2f3d-4699-9147-760056adfa75", "unitId": "341b2050-28cf-4d3d-bc44-ef5a0f6584d9", "endDate": null, "personId": "5dd27a32-c1ee-4826-bf18-db9df778eea3", "startDate": "2010-07-10T00:00:00.000Z", "occupancyType": "OWNER_OCCUPIED"}	2026-03-16 22:52:54.46421
fbe2a875-1e05-45eb-92fb-aeda42ae13aa	system	create	portal-access	d54cbf3c-d698-409e-99b0-74104a9e67e2	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "d54cbf3c-d698-409e-99b0-74104a9e67e2", "role": "owner", "email": "joseomarsanchez77@gmail.com", "status": "active", "unitId": "341b2050-28cf-4d3d-bc44-ef5a0f6584d9", "personId": "5dd27a32-c1ee-4826-bf18-db9df778eea3", "createdAt": "2026-03-16T22:52:54.471Z", "invitedAt": null, "invitedBy": null, "revokedAt": null, "updatedAt": "2026-03-16T22:52:54.471Z", "acceptedAt": "2026-03-16T22:52:54.471Z", "boardRoleId": null, "lastLoginAt": null, "suspendedAt": null, "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a"}	2026-03-16 22:52:54.475617
a1202783-3864-420b-a6e9-8d2191347444	system	create	ownership	e2e15920-485e-4f8c-b68b-90c35ea0230e	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "e2e15920-485e-4f8c-b68b-90c35ea0230e", "unitId": "91e77ac7-b0dc-4bab-a169-f167b20e5cce", "endDate": null, "personId": "3d5f7fc5-c5f6-4dcd-bfe6-cade8e8e2258", "startDate": "2018-09-27T00:00:00.000Z", "ownershipPercentage": 50}	2026-03-16 22:52:55.5894
e20cfe02-10f4-4d68-9ea8-e5f253327d1f	system	create	portal-access	2c0d5d9a-91ea-40f3-bebf-b1cc57ce2d68	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "2c0d5d9a-91ea-40f3-bebf-b1cc57ce2d68", "role": "owner", "email": "dhtorok@comcast.net", "status": "active", "unitId": "91e77ac7-b0dc-4bab-a169-f167b20e5cce", "personId": "3d5f7fc5-c5f6-4dcd-bfe6-cade8e8e2258", "createdAt": "2026-03-16T22:52:55.597Z", "invitedAt": null, "invitedBy": null, "revokedAt": null, "updatedAt": "2026-03-16T22:52:55.597Z", "acceptedAt": "2026-03-16T22:52:55.597Z", "boardRoleId": null, "lastLoginAt": null, "suspendedAt": null, "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a"}	2026-03-16 22:52:55.600839
842b902e-c23e-484d-850b-19edaa61e3a1	system	create	ownership	f05d0d22-d497-4c45-91ee-e7ee4efea8e2	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "f05d0d22-d497-4c45-91ee-e7ee4efea8e2", "unitId": "91e77ac7-b0dc-4bab-a169-f167b20e5cce", "endDate": null, "personId": "3d5f7fc5-c5f6-4dcd-bfe6-cade8e8e2258", "startDate": "2018-09-27T00:00:00.000Z", "ownershipPercentage": 50}	2026-03-16 22:52:55.612751
35516055-3384-40cb-9989-c06ccacb5591	system	update	portal-access	2c0d5d9a-91ea-40f3-bebf-b1cc57ce2d68	f301d073-ed84-4d73-84ce-3ef28af66f7a	{"id": "2c0d5d9a-91ea-40f3-bebf-b1cc57ce2d68", "role": "owner", "email": "dhtorok@comcast.net", "status": "active", "unitId": "91e77ac7-b0dc-4bab-a169-f167b20e5cce", "personId": "3d5f7fc5-c5f6-4dcd-bfe6-cade8e8e2258", "createdAt": "2026-03-16T22:52:55.597Z", "invitedAt": null, "invitedBy": null, "revokedAt": null, "updatedAt": "2026-03-16T22:52:55.597Z", "acceptedAt": "2026-03-16T22:52:55.597Z", "boardRoleId": null, "lastLoginAt": null, "suspendedAt": null, "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a"}	{"id": "2c0d5d9a-91ea-40f3-bebf-b1cc57ce2d68", "role": "owner", "email": "dhtorok@comcast.net", "status": "active", "unitId": "91e77ac7-b0dc-4bab-a169-f167b20e5cce", "personId": "3d5f7fc5-c5f6-4dcd-bfe6-cade8e8e2258", "createdAt": "2026-03-16T22:52:55.597Z", "invitedAt": null, "invitedBy": null, "revokedAt": null, "updatedAt": "2026-03-16T22:52:55.620Z", "acceptedAt": "2026-03-16T22:52:55.597Z", "boardRoleId": null, "lastLoginAt": null, "suspendedAt": null, "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a"}	2026-03-16 22:52:55.624145
7535f23c-8f2d-4d6c-821f-8f2f10da0134	system	create	occupancy	8b37fbe8-b1de-4534-9845-f763f8e83ad5	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "8b37fbe8-b1de-4534-9845-f763f8e83ad5", "unitId": "91e77ac7-b0dc-4bab-a169-f167b20e5cce", "endDate": null, "personId": "acf06065-a75c-45ab-9c55-b5fddecef158", "startDate": "2018-09-27T00:00:00.000Z", "occupancyType": "TENANT"}	2026-03-16 22:52:55.641564
9844f7c8-40d3-4aa6-a613-7d78305c49f0	system	create	portal-access	19d6ca13-1eed-4e58-89d8-d9be8af94b9b	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "19d6ca13-1eed-4e58-89d8-d9be8af94b9b", "role": "tenant", "email": "alleykat1616@gmail.com", "status": "active", "unitId": "91e77ac7-b0dc-4bab-a169-f167b20e5cce", "personId": "acf06065-a75c-45ab-9c55-b5fddecef158", "createdAt": "2026-03-16T22:52:55.649Z", "invitedAt": null, "invitedBy": null, "revokedAt": null, "updatedAt": "2026-03-16T22:52:55.648Z", "acceptedAt": "2026-03-16T22:52:55.648Z", "boardRoleId": null, "lastLoginAt": null, "suspendedAt": null, "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a"}	2026-03-16 22:52:55.652798
6442a4a7-345a-47ab-94d6-63ce69907614	yourcondomanagement@gmail.com	update	person	3d5f7fc5-c5f6-4dcd-bfe6-cade8e8e2258	\N	{"id": "3d5f7fc5-c5f6-4dcd-bfe6-cade8e8e2258", "email": "dhtorok@comcast.net", "phone": "2034849006  c2034004943", "lastName": "TOROK", "createdAt": "2026-03-16T22:52:55.577Z", "firstName": "Stephen", "mailingAddress": "1417 Quinnipiac Ave Unit G, New Haven, Connecticut, 06513", "contactPreference": "email", "emergencyContactName": null, "emergencyContactPhone": null}	{"id": "3d5f7fc5-c5f6-4dcd-bfe6-cade8e8e2258", "email": "dhtorok@comcast.net", "phone": "2034004943", "lastName": "TOROK", "createdAt": "2026-03-16T22:52:55.577Z", "firstName": "Stephen", "mailingAddress": "1417 Quinnipiac Ave Unit G, New Haven, Connecticut, 06513", "contactPreference": "email", "emergencyContactName": null, "emergencyContactPhone": null}	2026-03-16 22:53:53.111853
46a73803-88ae-44f5-9b57-002f50d2d66c	system	create	ownership	97a7487f-fe9e-4f4e-931b-681bc5d3108d	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "97a7487f-fe9e-4f4e-931b-681bc5d3108d", "unitId": "909ed4e8-fb53-49f8-aecf-5b56c10e1e30", "endDate": null, "personId": "5c600f8c-c59d-49ae-bdcd-94c8ef1c4625", "startDate": "2026-03-16T00:00:00.000Z", "ownershipPercentage": 100}	2026-03-17 01:21:02.713545
fd6b8f23-4293-4934-9569-d928eaef473f	system	create	occupancy	86d20d1c-f230-4c27-a663-ddd60adf4983	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "86d20d1c-f230-4c27-a663-ddd60adf4983", "unitId": "909ed4e8-fb53-49f8-aecf-5b56c10e1e30", "endDate": null, "personId": "5c600f8c-c59d-49ae-bdcd-94c8ef1c4625", "startDate": "2026-03-16T00:00:00.000Z", "occupancyType": "OWNER_OCCUPIED"}	2026-03-17 01:21:02.725308
969b792a-f80f-462a-9de2-41409646080c	system	create	portal-access	cc4bb536-0e35-414d-a436-64bb544d07da	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "cc4bb536-0e35-414d-a436-64bb544d07da", "role": "owner", "email": "gachigasim@gmail.com", "status": "active", "unitId": "909ed4e8-fb53-49f8-aecf-5b56c10e1e30", "personId": "5c600f8c-c59d-49ae-bdcd-94c8ef1c4625", "createdAt": "2026-03-17T01:21:02.732Z", "invitedAt": null, "invitedBy": null, "revokedAt": null, "updatedAt": "2026-03-17T01:21:02.732Z", "acceptedAt": "2026-03-17T01:21:02.732Z", "boardRoleId": null, "lastLoginAt": null, "suspendedAt": null, "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a"}	2026-03-17 01:21:02.73606
7190e41e-8018-4ebb-a2d8-bac0b5fa5857	yourcondomanagement@gmail.com	create	person	348cc250-9f30-47d1-81c9-8f535f479bb4	\N	\N	{"id": "348cc250-9f30-47d1-81c9-8f535f479bb4", "email": "graphie20@gmail.com", "phone": null, "lastName": "Sanchez", "createdAt": "2026-03-17T13:34:14.745Z", "firstName": "Madea", "mailingAddress": null, "contactPreference": "email", "emergencyContactName": null, "emergencyContactPhone": null}	2026-03-17 13:34:14.777886
d826f2d7-df17-4a2e-97c5-28f63bd7986c	yourcondomanagement@gmail.com	create	person	2fcd7d8c-13c0-4d5b-96d3-0f2ec2131c65	\N	\N	{"id": "2fcd7d8c-13c0-4d5b-96d3-0f2ec2131c65", "email": "rnsofor@yahoo.com", "phone": "203-980-1193", "lastName": "Robinson", "createdAt": "2026-03-17T13:36:38.345Z", "firstName": "Nsofor", "mailingAddress": "1415 A Quinnipiac", "contactPreference": "email", "emergencyContactName": null, "emergencyContactPhone": null}	2026-03-17 13:36:38.360208
ae2466e4-bdbd-4060-8363-90febd9e8672	yourcondomanagement@gmail.com	update	association	f301d073-ed84-4d73-84ce-3ef28af66f7a	f301d073-ed84-4d73-84ce-3ef28af66f7a	{"id": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "ein": "", "city": "New Haven", "name": "Cherry Hill Court Condominiums", "state": "CT", "address": "1405 Quinnipiac Ave.", "country": "USA", "createdAt": "2026-03-07T17:15:42.394Z", "archivedAt": null, "dateFormed": "1990-07-16", "isArchived": 0, "associationType": ""}	{"id": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "ein": "06-1513429", "city": "New Haven", "name": "Cherry Hill Court Condominiums", "state": "CT", "address": "1405 Quinnipiac Ave.", "country": "USA", "createdAt": "2026-03-07T17:15:42.394Z", "archivedAt": null, "dateFormed": "1990-07-16", "isArchived": 0, "associationType": ""}	2026-03-17 13:49:18.049736
c961870d-7a3e-4fab-8ded-3457815fe21a	yourcondomanagement@gmail.com	update	association	f301d073-ed84-4d73-84ce-3ef28af66f7a	f301d073-ed84-4d73-84ce-3ef28af66f7a	{"id": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "ein": "06-1513429", "city": "New Haven", "name": "Cherry Hill Court Condominiums", "state": "CT", "address": "1405 Quinnipiac Ave.", "country": "USA", "createdAt": "2026-03-07T17:15:42.394Z", "archivedAt": null, "dateFormed": "1990-07-16", "isArchived": 0, "associationType": ""}	{"id": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "ein": "06-1513429", "city": "New Haven", "name": "Cherry Hill Court Condominiums", "state": "CT", "address": "1405 Quinnipiac Ave.", "country": "USA", "createdAt": "2026-03-07T17:15:42.394Z", "archivedAt": null, "dateFormed": "1990-07-16", "isArchived": 0, "associationType": "HOA"}	2026-03-17 13:49:26.151387
77186647-01ac-4a19-a1ff-b4f1e23f2897	yourcondomanagement@gmail.com	update	association	5d4488b7-c229-4412-8762-d822e4f150f3	5d4488b7-c229-4412-8762-d822e4f150f3	{"id": "5d4488b7-c229-4412-8762-d822e4f150f3", "ein": null, "city": "New Haven", "name": "QA Communications Foundation 364067", "state": "CT", "address": "100 Verification Way", "country": "USA", "createdAt": "2026-03-11T14:12:44.087Z", "archivedAt": null, "dateFormed": null, "isArchived": 0, "associationType": null}	{"id": "5d4488b7-c229-4412-8762-d822e4f150f3", "ein": null, "city": "New Haven", "name": "QA Communications Foundation 364067", "state": "CT", "address": "100 Verification Way", "country": "USA", "createdAt": "2026-03-11T14:12:44.087Z", "archivedAt": "2026-03-17T13:49:57.152Z", "dateFormed": null, "isArchived": 1, "associationType": null}	2026-03-17 13:49:57.19426
09424f2f-b0fa-4ce9-86f5-8ec9ee6990c7	yourcondomanagement@gmail.com	update	association	f61e4b10-01a3-4670-87b3-c2a7749b2958	f61e4b10-01a3-4670-87b3-c2a7749b2958	{"id": "f61e4b10-01a3-4670-87b3-c2a7749b2958", "ein": null, "city": "Austin", "name": "Building First Verify A 092492", "state": "TX", "address": "100 Verify Way", "country": "USA", "createdAt": "2026-03-12T16:31:32.513Z", "archivedAt": null, "dateFormed": null, "isArchived": 0, "associationType": null}	{"id": "f61e4b10-01a3-4670-87b3-c2a7749b2958", "ein": null, "city": "Austin", "name": "Building First Verify A 092492", "state": "TX", "address": "100 Verify Way", "country": "USA", "createdAt": "2026-03-12T16:31:32.513Z", "archivedAt": "2026-03-17T13:49:58.782Z", "dateFormed": null, "isArchived": 1, "associationType": null}	2026-03-17 13:49:58.787505
5577fa0f-5ae2-4598-8801-cd3b75890859	yourcondomanagement@gmail.com	update	association	8c579997-ec38-4389-9e78-dbf34ba80947	8c579997-ec38-4389-9e78-dbf34ba80947	{"id": "8c579997-ec38-4389-9e78-dbf34ba80947", "ein": null, "city": "Austin", "name": "Building First Verify B 092492", "state": "TX", "address": "200 Verify Way", "country": "USA", "createdAt": "2026-03-12T16:31:32.525Z", "archivedAt": null, "dateFormed": null, "isArchived": 0, "associationType": null}	{"id": "8c579997-ec38-4389-9e78-dbf34ba80947", "ein": null, "city": "Austin", "name": "Building First Verify B 092492", "state": "TX", "address": "200 Verify Way", "country": "USA", "createdAt": "2026-03-12T16:31:32.525Z", "archivedAt": "2026-03-17T13:50:00.478Z", "dateFormed": null, "isArchived": 1, "associationType": null}	2026-03-17 13:50:00.483116
6a0fa437-83b3-42b0-9fd1-f67b0e14d416	yourcondomanagement@gmail.com	update	association	7c164b67-9e3b-456a-bb49-dd698b0822c4	7c164b67-9e3b-456a-bb49-dd698b0822c4	{"id": "7c164b67-9e3b-456a-bb49-dd698b0822c4", "ein": null, "city": "New Haven", "name": "Verification HOA 1773579706183", "state": "CT", "address": "1 Verification Way", "country": "USA", "createdAt": "2026-03-15T13:01:46.238Z", "archivedAt": null, "dateFormed": null, "isArchived": 0, "associationType": "condo"}	{"id": "7c164b67-9e3b-456a-bb49-dd698b0822c4", "ein": null, "city": "New Haven", "name": "Verification HOA 1773579706183", "state": "CT", "address": "1 Verification Way", "country": "USA", "createdAt": "2026-03-15T13:01:46.238Z", "archivedAt": "2026-03-17T13:50:01.746Z", "dateFormed": null, "isArchived": 1, "associationType": "condo"}	2026-03-17 13:50:01.751319
1d8286bc-b189-4126-8714-147b1a593eb7	yourcondomanagement@gmail.com	update	association	628b7d4b-b052-44a5-9bcc-69784581450c	628b7d4b-b052-44a5-9bcc-69784581450c	{"id": "628b7d4b-b052-44a5-9bcc-69784581450c", "ein": null, "city": "Cherry Hill", "name": "Cherry Hill Court", "state": "NJ", "address": "101 Cherry Hill Court", "country": "USA", "createdAt": "2026-03-15T14:59:57.296Z", "archivedAt": null, "dateFormed": null, "isArchived": 0, "associationType": "condo"}	{"id": "628b7d4b-b052-44a5-9bcc-69784581450c", "ein": null, "city": "Cherry Hill", "name": "Cherry Hill Court", "state": "NJ", "address": "101 Cherry Hill Court", "country": "USA", "createdAt": "2026-03-15T14:59:57.296Z", "archivedAt": "2026-03-17T13:50:03.428Z", "dateFormed": null, "isArchived": 1, "associationType": "condo"}	2026-03-17 13:50:03.434419
f90ed085-e826-447d-9bc2-dfb4db6c0816	yourcondomanagement@gmail.com	update	association	1c63e35c-2ac3-4b0a-b2ab-61f873d0d938	1c63e35c-2ac3-4b0a-b2ab-61f873d0d938	{"id": "1c63e35c-2ac3-4b0a-b2ab-61f873d0d938", "ein": null, "city": "Austin", "name": "Test Towers", "state": "TX", "address": "100 Test Ave", "country": "USA", "createdAt": "2026-03-06T16:23:32.832Z", "archivedAt": null, "dateFormed": null, "isArchived": 0, "associationType": null}	{"id": "1c63e35c-2ac3-4b0a-b2ab-61f873d0d938", "ein": null, "city": "Austin", "name": "Test Towers", "state": "TX", "address": "100 Test Ave", "country": "USA", "createdAt": "2026-03-06T16:23:32.832Z", "archivedAt": "2026-03-17T13:50:05.737Z", "dateFormed": null, "isArchived": 1, "associationType": null}	2026-03-17 13:50:05.744243
ebc85e04-5064-425b-b007-46f48a251dd1	yourcondomanagement@gmail.com	update	association	ba806fad-1586-4013-ab62-18cbb360b007	ba806fad-1586-4013-ab62-18cbb360b007	{"id": "ba806fad-1586-4013-ab62-18cbb360b007", "ein": null, "city": "x", "name": "Dbg Assoc", "state": "TX", "address": "1", "country": "USA", "createdAt": "2026-03-09T15:39:46.428Z", "archivedAt": null, "dateFormed": null, "isArchived": 0, "associationType": null}	{"id": "ba806fad-1586-4013-ab62-18cbb360b007", "ein": null, "city": "x", "name": "Dbg Assoc", "state": "TX", "address": "1", "country": "USA", "createdAt": "2026-03-09T15:39:46.428Z", "archivedAt": "2026-03-17T13:50:08.478Z", "dateFormed": null, "isArchived": 1, "associationType": null}	2026-03-17 13:50:08.487934
7a65f246-75ef-454b-a349-c805202b54cd	yourcondomanagement@gmail.com	update	unit	7adb3521-845b-41de-8054-3281ddfc0f3c	f301d073-ed84-4d73-84ce-3ef28af66f7a	{"id": "7adb3521-845b-41de-8054-3281ddfc0f3c", "building": "1415", "createdAt": "2026-03-14T14:37:34.228Z", "buildingId": "b11ea5a8-d907-4063-a0ed-640874159f61", "unitNumber": "A", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	{"id": "7adb3521-845b-41de-8054-3281ddfc0f3c", "building": "1415", "createdAt": "2026-03-14T14:37:34.228Z", "buildingId": "b11ea5a8-d907-4063-a0ed-640874159f61", "unitNumber": "A", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-17 13:54:05.926508
245dba1f-8222-43cd-9d0c-f2a348c1c285	yourcondomanagement@gmail.com	update	unit	7adb3521-845b-41de-8054-3281ddfc0f3c	f301d073-ed84-4d73-84ce-3ef28af66f7a	{"id": "7adb3521-845b-41de-8054-3281ddfc0f3c", "building": "1415", "createdAt": "2026-03-14T14:37:34.228Z", "buildingId": "b11ea5a8-d907-4063-a0ed-640874159f61", "unitNumber": "A", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	{"id": "7adb3521-845b-41de-8054-3281ddfc0f3c", "building": "1415", "createdAt": "2026-03-14T14:37:34.228Z", "buildingId": "b11ea5a8-d907-4063-a0ed-640874159f61", "unitNumber": "A", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-17 13:58:43.608585
a8cbdd98-7ca7-4b4a-8408-f69fedac893c	yourcondomanagement@gmail.com	create	ownership	0b3db0d5-e720-4469-bd29-36ce65e7eff9	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "0b3db0d5-e720-4469-bd29-36ce65e7eff9", "unitId": "7adb3521-845b-41de-8054-3281ddfc0f3c", "endDate": null, "personId": "2fcd7d8c-13c0-4d5b-96d3-0f2ec2131c65", "startDate": "2026-03-17T13:58:43.652Z", "ownershipPercentage": 100}	2026-03-17 13:58:43.734347
b6891513-5a63-4db2-91e2-26348fe4c064	yourcondomanagement@gmail.com	create	person	0892c9b2-1cc1-4e21-bd9b-68bd1ce2e521	\N	\N	{"id": "0892c9b2-1cc1-4e21-bd9b-68bd1ce2e521", "email": "minerva.miranda57@outlook.com", "phone": "2036451457", "lastName": "Minerva", "createdAt": "2026-03-17T14:00:40.763Z", "firstName": "Luz", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "mailingAddress": "10 Legend Lane, East Haven, Connecticut, United States", "contactPreference": "email", "emergencyContactName": null, "emergencyContactPhone": null}	2026-03-17 14:00:40.777324
f55e4f3a-1f8f-4b14-baf2-7f306733ce5d	yourcondomanagement@gmail.com	create	ownership	875bead3-2fc7-4caa-9c7e-a6afe83f5d65	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "875bead3-2fc7-4caa-9c7e-a6afe83f5d65", "unitId": "f5d74705-ef3d-439d-bf89-a2c1c2a17f34", "endDate": null, "personId": "0892c9b2-1cc1-4e21-bd9b-68bd1ce2e521", "startDate": "2026-03-17T14:00:40.821Z", "ownershipPercentage": 100}	2026-03-17 14:00:40.890318
c77d6fda-f588-4a19-bc79-f8134dc3947e	yourcondomanagement@gmail.com	create	board-role	1d244eee-764e-47f8-89df-fe8fb69d5e3e	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "1d244eee-764e-47f8-89df-fe8fb69d5e3e", "role": "Treasurer", "endDate": null, "personId": "0892c9b2-1cc1-4e21-bd9b-68bd1ce2e521", "startDate": "2024-01-01T00:00:00.000Z", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a"}	2026-03-17 14:01:10.366573
357f4d66-33eb-45a0-8a65-1b203c4ab569	yourcondomanagement@gmail.com	update	unit	7adb3521-845b-41de-8054-3281ddfc0f3c	f301d073-ed84-4d73-84ce-3ef28af66f7a	{"id": "7adb3521-845b-41de-8054-3281ddfc0f3c", "building": "1415", "createdAt": "2026-03-14T14:37:34.228Z", "buildingId": "b11ea5a8-d907-4063-a0ed-640874159f61", "unitNumber": "A", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	{"id": "7adb3521-845b-41de-8054-3281ddfc0f3c", "building": "1415", "createdAt": "2026-03-14T14:37:34.228Z", "buildingId": "b11ea5a8-d907-4063-a0ed-640874159f61", "unitNumber": "A", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-17 14:25:52.554231
f841971c-8583-4ad3-81bc-7ff364e90916	yourcondomanagement@gmail.com	create	occupancy	01dcb395-e2fb-46b1-88a3-8afc4de68de1	f301d073-ed84-4d73-84ce-3ef28af66f7a	\N	{"id": "01dcb395-e2fb-46b1-88a3-8afc4de68de1", "unitId": "7adb3521-845b-41de-8054-3281ddfc0f3c", "endDate": null, "personId": "2fcd7d8c-13c0-4d5b-96d3-0f2ec2131c65", "startDate": "2026-03-17T14:25:52.599Z", "occupancyType": "TENANT"}	2026-03-17 14:25:52.714136
e25b72c7-71b9-45c0-afab-13dca7c3aaf7	yourcondomanagement@gmail.com	update	unit	7adb3521-845b-41de-8054-3281ddfc0f3c	f301d073-ed84-4d73-84ce-3ef28af66f7a	{"id": "7adb3521-845b-41de-8054-3281ddfc0f3c", "building": "1415", "createdAt": "2026-03-14T14:37:34.228Z", "buildingId": "b11ea5a8-d907-4063-a0ed-640874159f61", "unitNumber": "A", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	{"id": "7adb3521-845b-41de-8054-3281ddfc0f3c", "building": "1415", "createdAt": "2026-03-14T14:37:34.228Z", "buildingId": "b11ea5a8-d907-4063-a0ed-640874159f61", "unitNumber": "A", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-17 14:29:00.004011
eaafc913-0049-4a7a-af44-7f9d4140e250	yourcondomanagement@gmail.com	update	unit	7adb3521-845b-41de-8054-3281ddfc0f3c	f301d073-ed84-4d73-84ce-3ef28af66f7a	{"id": "7adb3521-845b-41de-8054-3281ddfc0f3c", "building": "1415", "createdAt": "2026-03-14T14:37:34.228Z", "buildingId": "b11ea5a8-d907-4063-a0ed-640874159f61", "unitNumber": "A", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	{"id": "7adb3521-845b-41de-8054-3281ddfc0f3c", "building": "1415", "createdAt": "2026-03-14T14:37:34.228Z", "buildingId": "b11ea5a8-d907-4063-a0ed-640874159f61", "unitNumber": "A", "associationId": "f301d073-ed84-4d73-84ce-3ef28af66f7a", "squareFootage": null}	2026-03-17 14:34:52.260369
\.


--
-- Data for Name: auth_external_accounts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.auth_external_accounts (id, user_id, provider, provider_account_id, provider_email, profile_json, created_at, updated_at) FROM stdin;
b748b612-17a9-4986-83cd-cb6a15ed4113	f255a7d2-fd0c-4e35-85f6-3cedd715e4b9	google	110910258480932559249	yourcondomanagement@gmail.com	{"sub": "110910258480932559249", "name": "Your Condo Management", "email": "yourcondomanagement@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocKTAZsV6wkrspg8gNqwaO1eUmLeNsXO50qsD0CmsLZRKI4bXg=s96-c", "given_name": "Your Condo Management", "email_verified": true}	2026-03-16 22:49:15.603062	2026-03-16 22:49:15.603062
\.


--
-- Data for Name: auth_users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.auth_users (id, admin_user_id, email, first_name, last_name, avatar_url, is_active, last_login_at, created_at, updated_at) FROM stdin;
6216cbc8-2481-4814-9f27-2d38cd1c8d45	ae7a1d67-d01a-4041-ac39-68e1519ee77d	chcmgmt18@gmail.com	CHC	Management	\N	1	\N	2026-03-16 13:12:30.553001	2026-03-16 13:12:30.553001
f255a7d2-fd0c-4e35-85f6-3cedd715e4b9	b4d20095-aa16-42fa-97b3-99b688a6a323	yourcondomanagement@gmail.com	Your Condo Management	\N	https://lh3.googleusercontent.com/a/ACg8ocKTAZsV6wkrspg8gNqwaO1eUmLeNsXO50qsD0CmsLZRKI4bXg=s96-c	1	2026-03-16 22:49:17.798	2026-03-16 22:49:15.598517	2026-03-16 22:49:17.798
\.


--
-- Data for Name: autopay_enrollments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.autopay_enrollments (id, association_id, unit_id, person_id, amount, frequency, day_of_month, status, next_payment_date, description, enrolled_by, enrolled_at, cancelled_by, cancelled_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: autopay_runs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.autopay_runs (id, enrollment_id, association_id, amount, status, ledger_entry_id, error_message, ran_at, created_at) FROM stdin;
\.


--
-- Data for Name: bank_statement_imports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bank_statement_imports (id, association_id, filename, imported_by, statement_date, opening_balance, closing_balance, transaction_count, status, notes, created_at) FROM stdin;
\.


--
-- Data for Name: bank_statement_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bank_statement_transactions (id, import_id, association_id, transaction_date, description, amount, bank_reference, check_number, match_status, matched_ledger_entry_id, matched_by, matched_at, match_notes, created_at) FROM stdin;
\.


--
-- Data for Name: board_package_templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.board_package_templates (id, association_id, title, frequency, sections_json, notes, created_at, updated_at, auto_generate, meeting_type, generate_days_before, last_auto_generated_at) FROM stdin;
\.


--
-- Data for Name: board_packages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.board_packages (id, template_id, association_id, title, period_label, status, content_json, annotations_json, created_at, updated_at, meeting_id, approved_by, approved_at, distributed_by, distributed_at) FROM stdin;
\.


--
-- Data for Name: board_roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.board_roles (id, person_id, association_id, role, start_date, end_date) FROM stdin;
35c2c5fc-d1e3-4569-b24c-40ff5d5ec332	0d0da41f-792c-4c4e-80b5-cc8cc48f643d	e60c349e-b14e-48fa-a72e-8af3c2180c74	President	2023-01-01 00:00:00	\N
60dfc8c6-6d01-4a3b-8895-78a965f9260a	88a352fb-a6c8-48b6-adc5-de3a0e48cf90	e60c349e-b14e-48fa-a72e-8af3c2180c74	Treasurer	2023-01-01 00:00:00	\N
a151b4d3-aaaf-483a-b46d-710eac805479	98644005-412a-4640-9911-e8f8166dd71e	7a1f216a-8ac9-4fe9-a8d2-b62b01565a42	President	2022-06-01 00:00:00	\N
1fc8a0a7-244a-4ac6-969e-08aaee7c5da0	eb590fdb-bee3-42ce-b611-2cf3d61b4e2e	7a1f216a-8ac9-4fe9-a8d2-b62b01565a42	Secretary	2022-06-01 00:00:00	\N
37c49659-dd03-492c-aef7-3e6badc2f288	9144a5a1-8e77-481c-a93f-8246841b6020	f627dc9b-cde0-44c0-a23a-405487cb0add	President	2021-01-01 00:00:00	\N
5162cf40-be03-4710-9924-687e7c35d1e1	d645338d-bf6e-47ac-8961-6f307fff8eb9	f627dc9b-cde0-44c0-a23a-405487cb0add	Board Member	2024-01-15 00:00:00	\N
7efa2469-58dd-4ea2-91ac-4d15950bcc7d	f49f0d4b-01fd-4ea3-b8be-2d70229eb549	f301d073-ed84-4d73-84ce-3ef28af66f7a	Board Member	2026-03-04 00:00:00	\N
bb3b9e0e-2212-4309-acfc-da8a74617bb4	39a0b470-42dc-47e3-a009-3acb4ae84f28	7a1f216a-8ac9-4fe9-a8d2-b62b01565a42	President	2023-01-01 00:00:00	\N
872a575e-d952-40cc-8bd8-19eea94e241d	c9cf7e6c-c048-4be7-9feb-b07021ce9c69	7a1f216a-8ac9-4fe9-a8d2-b62b01565a42	Treasurer	2023-01-01 00:00:00	\N
4f27850c-6a21-4630-8552-0c1dcde46c2e	0d78d695-6a3a-47ca-adc6-591c6c7a733c	f627dc9b-cde0-44c0-a23a-405487cb0add	President	2022-06-01 00:00:00	\N
6ec30ab5-6c6f-427a-b1df-f53c466af5db	57835f87-9a88-44a1-bfb8-f70b501ac5e7	f627dc9b-cde0-44c0-a23a-405487cb0add	Secretary	2022-06-01 00:00:00	\N
b10f89fa-6069-44b6-ac01-31d550a5af45	6aa1ff35-a949-409b-8adc-fc354e493d4f	e60c349e-b14e-48fa-a72e-8af3c2180c74	President	2021-01-01 00:00:00	\N
ec3a74f1-beb4-4786-9e1b-c52126e02aea	b7e6e265-f34e-47e3-9204-04db6da2b083	e60c349e-b14e-48fa-a72e-8af3c2180c74	Board Member	2024-01-15 00:00:00	\N
1d244eee-764e-47f8-89df-fe8fb69d5e3e	0892c9b2-1cc1-4e21-bd9b-68bd1ce2e521	f301d073-ed84-4d73-84ce-3ef28af66f7a	Treasurer	2024-01-01 00:00:00	\N
\.


--
-- Data for Name: budget_lines; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.budget_lines (id, budget_version_id, account_id, category_id, line_item_name, planned_amount, sort_order, created_at, updated_at) FROM stdin;
39f08e1c-07bc-4393-acfc-849e3b2d34ad	0b0a4fa3-ed41-4145-809d-83eecaa31b2e	\N	47158156-38dc-40ff-b594-70cf3b6b9ae2	Water Utilities	1200	1	2026-03-07 17:55:57.158838	2026-03-07 17:55:57.158
bcaaecb3-a8c0-4f42-9d36-31a2b928fa45	f40b143e-a2eb-470f-8b12-d005d89e21c9	\N	8378e8e0-7d8f-46d3-8faa-9fffbe37b708	Water Utilities	1200	1	2026-03-07 18:37:31.965432	2026-03-07 18:37:31.965
\.


--
-- Data for Name: budget_versions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.budget_versions (id, budget_id, version_number, status, notes, ratified_at, created_at, updated_at) FROM stdin;
0b0a4fa3-ed41-4145-809d-83eecaa31b2e	b8c22e13-2a91-4091-81d2-74a7c448dce2	1	ratified	runtime verify	2026-03-07 17:55:57.169	2026-03-07 17:55:57.154342	2026-03-07 17:55:57.169
f40b143e-a2eb-470f-8b12-d005d89e21c9	73b1cb8f-7cb1-4fca-8174-51f8a9b7e39b	1	ratified	runtime verify	2026-03-07 18:37:31.97	2026-03-07 18:37:31.961805	2026-03-07 18:37:31.97
\.


--
-- Data for Name: budgets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.budgets (id, association_id, name, fiscal_year, period_start, period_end, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: buildings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.buildings (id, association_id, name, address, total_units, notes, created_at, updated_at) FROM stdin;
cb058638-da68-4b2b-b961-7bed993cc5e6	f61e4b10-01a3-4670-87b3-c2a7749b2958	Building-A-092492	100 Verify Way	12	verification	2026-03-12 16:31:32.532002	2026-03-12 16:31:32.532002
54e1f380-db0a-4112-80d3-59c760e3687f	8c579997-ec38-4389-9e78-dbf34ba80947	Building-B-092492	200 Verify Way	6	verification	2026-03-12 16:31:32.53988	2026-03-12 16:31:32.53988
f249583c-5d75-4865-a6ca-d01f0b4dd3a6	f301d073-ed84-4d73-84ce-3ef28af66f7a	1417	Quinnipiac Ave., New Haven, CT 06513	7	\N	2026-03-12 20:08:27.895727	2026-03-12 20:08:27.895727
e4f64f48-6136-457c-af87-20223cfc81ef	f301d073-ed84-4d73-84ce-3ef28af66f7a	1421	1421 Quinnipiac Ave.	4	Backfilled from legacy unit building labels.	2026-03-12 20:22:42.379901	2026-03-12 20:22:42.379901
b75865cb-9980-496d-9bb1-0e5a5a964391	5d4488b7-c229-4412-8762-d822e4f150f3	A	100 Verification Way	\N	Backfilled from legacy unit building labels.	2026-03-12 20:22:42.379901	2026-03-12 20:22:42.379901
b11ea5a8-d907-4063-a0ed-640874159f61	f301d073-ed84-4d73-84ce-3ef28af66f7a	1415	Quinnipiac Ave., New Haven, CT 06513	1	\N	2026-03-14 14:33:49.910494	2026-03-14 14:33:49.910494
8a0fafb2-cc66-400f-a3dc-74617e39eefc	f301d073-ed84-4d73-84ce-3ef28af66f7a	1419	Quinnipiac Ave., New Haven, CT 06513	1	\N	2026-03-14 14:38:11.444605	2026-03-14 14:38:11.444605
\.


--
-- Data for Name: calendar_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.calendar_events (id, association_id, event_type, title, starts_at, ends_at, related_type, related_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: clause_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.clause_records (id, ingestion_job_id, extracted_record_id, association_id, source_document_id, title, clause_text, confidence_score, review_status, reviewed_by, reviewed_at, created_at, updated_at, superseded_at) FROM stdin;
b0467640-da3a-480e-831b-e19507f5c663	cb85bb6c-f00e-45d7-8d72-e8d7ca657382	\N	\N	\N	General Bylaw Clause	Board Meeting Minutes\nAgenda: budget update and reserve study\nResolution: approve 2026 budget draft	0.62	pending-review	\N	\N	2026-03-09 15:39:07.429637	2026-03-09 15:39:07.429	\N
e30d9d81-c1b3-4aff-b95b-6fe403908277	79a04089-c591-4e0c-8a52-1266355a7d83	\N	\N	\N	General Bylaw Clause	Board Meeting Minutes\nAgenda: budget update and reserve study\nResolution: approve 2026 budget draft	0.62	pending-review	\N	\N	2026-03-09 15:39:33.296235	2026-03-09 15:39:33.295	\N
36408554-891f-401b-9c06-8cb5e8d62c41	a31c0433-5d03-47de-a983-48a8f3e08117	\N	\N	\N	General Bylaw Clause	Board Meeting Minutes\nAgenda: budget update and reserve study\nResolution: approve 2026 budget draft	0.62	pending-review	\N	\N	2026-03-09 15:40:31.271216	2026-03-09 15:40:31.27	\N
06ad66ca-05a6-4156-98a3-fe559da8d7c5	ca717ff6-7717-46a0-88a5-8ed5c202cf93	\N	\N	\N	General Bylaw Clause	Board Meeting Minutes\nAgenda: budget update and reserve study\nResolution: approve 2026 budget draft	0.62	pending-review	\N	\N	2026-03-09 15:49:37.219565	2026-03-09 15:49:37.219	\N
8d016d51-526e-4d5e-af78-39c3094a3479	7da95864-7920-4cb5-b2d3-a731a607cf9c	\N	\N	\N	General Bylaw Clause	Board Meeting Minutes\nAgenda: budget update and reserve study\nResolution: approve 2026 budget draft	0.62	pending-review	\N	\N	2026-03-09 19:45:31.326432	2026-03-09 19:45:31.325	\N
6f0dc254-4b8c-48ea-a211-8b8118c8cc7e	1fa09545-fa3c-4771-a142-59f6551176e5	\N	\N	\N	General Bylaw Clause	Board Meeting Minutes\nAgenda: budget update and reserve study\nResolution: approve 2026 budget draft	0.62	pending-review	\N	\N	2026-03-09 19:46:43.312377	2026-03-09 19:46:43.311	\N
\.


--
-- Data for Name: clause_tags; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.clause_tags (id, clause_record_id, tag, created_at) FROM stdin;
00170371-7800-42cb-a50c-e775ef61e7e5	64dc7d44-08f4-42cd-8067-62f460704ccc	meetings	2026-03-07 18:12:38.032288
bcb4dd65-c9e0-4c3b-b5cc-8749b57cebf2	95236d59-99f9-4971-a8c3-a1d8b64620dd	meetings	2026-03-07 18:12:38.039832
f81d481c-ff3c-4c76-8086-9b6dd01b42ba	95236d59-99f9-4971-a8c3-a1d8b64620dd	budget	2026-03-07 18:12:38.043491
6ec1a080-a8b8-4282-b074-cc088e840149	95236d59-99f9-4971-a8c3-a1d8b64620dd	notice	2026-03-07 18:12:38.051036
8c4604e5-2618-4928-9199-6287648896f3	5adfd1b8-a066-4a3a-a044-7e789b18e589	budget	2026-03-07 18:12:38.05973
b7fd7068-9898-4ef0-9f34-1a03169a0dee	0de357ba-c18f-44d7-b630-5c7255ee7b7f	meetings	2026-03-07 18:37:53.743197
efb8d76b-fc8d-4e40-883b-9ec5d3649ba2	a6196f56-1361-4ebd-845f-7717ecd7a6d1	meetings	2026-03-07 18:37:53.749643
8a0435e6-0eea-47d6-b6d5-27546459f9c5	a6196f56-1361-4ebd-845f-7717ecd7a6d1	budget	2026-03-07 18:37:53.752591
c0243b60-1c06-47fb-bf11-59b749155376	a6196f56-1361-4ebd-845f-7717ecd7a6d1	notice	2026-03-07 18:37:53.759804
3c0cc2a4-1168-45b8-a84c-eadc67769fc6	e04d43fb-58b3-4103-a910-24c152ee40d2	budget	2026-03-07 18:37:53.769078
c830646c-bcaf-4332-9fa9-4531859f97c3	b0467640-da3a-480e-831b-e19507f5c663	meetings	2026-03-09 15:39:07.434859
04805fcb-a006-4186-ac9c-257c1ba4a9ad	b0467640-da3a-480e-831b-e19507f5c663	budget	2026-03-09 15:39:07.439693
1e5bec51-00bf-4aaf-9695-0ae7df9349bd	e30d9d81-c1b3-4aff-b95b-6fe403908277	meetings	2026-03-09 15:39:33.299597
0604ead6-eea1-4c81-a6ab-7fbc92d667ee	e30d9d81-c1b3-4aff-b95b-6fe403908277	budget	2026-03-09 15:39:33.302633
4e228774-8a04-43d2-b08f-9eb7d4f0a7b1	36408554-891f-401b-9c06-8cb5e8d62c41	meetings	2026-03-09 15:40:31.273973
8a83d558-737a-4989-b4bb-37f95b57e897	36408554-891f-401b-9c06-8cb5e8d62c41	budget	2026-03-09 15:40:31.277322
cac529f4-34ef-442f-baed-db7188e52926	06ad66ca-05a6-4156-98a3-fe559da8d7c5	meetings	2026-03-09 15:49:37.22369
32cfb217-4713-4611-ab77-3ca8e4f2be20	06ad66ca-05a6-4156-98a3-fe559da8d7c5	budget	2026-03-09 15:49:37.228058
361883a2-13d3-41b5-8bbd-fc7cdc758343	8d016d51-526e-4d5e-af78-39c3094a3479	meetings	2026-03-09 19:45:31.330177
0aed021f-530f-49b4-87ed-01657cf60d07	8d016d51-526e-4d5e-af78-39c3094a3479	budget	2026-03-09 19:45:31.333575
2b84b964-a4ab-4b69-84d7-10b905308c8e	6f0dc254-4b8c-48ea-a211-8b8118c8cc7e	meetings	2026-03-09 19:46:43.316197
a128ba54-9228-41fe-b25a-bdaa3b01d302	6f0dc254-4b8c-48ea-a211-8b8118c8cc7e	budget	2026-03-09 19:46:43.319614
\.


--
-- Data for Name: collections_handoffs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.collections_handoffs (id, association_id, unit_id, person_id, referral_date, referral_amount, current_balance, days_past_due, status, agency_name, agency_contact_name, agency_email, agency_phone, agency_case_number, settlement_amount, settlement_date, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: communication_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.communication_history (id, association_id, channel, direction, subject, body_snippet, recipient_email, recipient_person_id, related_type, related_id, metadata_json, created_at) FROM stdin;
c0160bbc-afb8-4b70-9d75-27e28af832b2	5d4488b7-c229-4412-8762-d822e4f150f3	email	outbound	Payment Setup Instructions	Methods:\n1. ACH Transfer: Use routing 011000015 and account 123456789.\nSupport: billing@example.com	qa-owner-364067@example.com	23a44250-f9b2-42a0-ba62-b3ef119a8f54	notice-awaiting-approval	f60772c5-6e5f-4d9f-a49b-98e899005679	{"status": "pending-approval", "scheduledFor": "2026-03-11T14:12:44.212Z"}	2026-03-11 14:12:44.218628
7922749a-1992-4e52-9052-105a753fce09	5d4488b7-c229-4412-8762-d822e4f150f3	email	outbound	Payment Setup Instructions	Methods:\n1. ACH Transfer: Use routing 011000015 and account 123456789.\nSupport: billing@example.com	qa-owner-364067@example.com	23a44250-f9b2-42a0-ba62-b3ef119a8f54	notice-send	f60772c5-6e5f-4d9f-a49b-98e899005679	{"provider": "internal-mock", "providerMessageId": "mock-1773238364226"}	2026-03-11 14:12:44.230116
f92453f3-5657-4337-8b8f-422cb6a0dddc	5d4488b7-c229-4412-8762-d822e4f150f3	portal	inbound	Maintenance request: Urgent leak	Water leak in ceiling near bathroom vent.	\N	23a44250-f9b2-42a0-ba62-b3ef119a8f54	maintenance-request	aaef153e-cccc-48a6-a46c-343ebab567f3	{"status": "submitted", "priority": "urgent"}	2026-03-11 14:12:44.24376
73f44595-938d-4d19-81cd-1f3476a8fa5c	5d4488b7-c229-4412-8762-d822e4f150f3	email	outbound	Maintenance escalation stage 1: Urgent leak	Request aaef153e-cccc-48a6-a46c-343ebab567f3 exceeded SLA response due at 2026-03-11T13:12:44.252Z.	\N	\N	maintenance-escalation	aaef153e-cccc-48a6-a46c-343ebab567f3	{"priority": "urgent", "actorEmail": "qa-scheduler@local", "escalationStage": 1}	2026-03-11 14:12:44.261063
9e0c51d0-0927-48e2-9acb-e2450c8a2dcb	5d4488b7-c229-4412-8762-d822e4f150f3	email	outbound	Maintenance escalation stage 2: Urgent leak	Request aaef153e-cccc-48a6-a46c-343ebab567f3 exceeded SLA response due at 2026-03-11T13:12:44.252Z.	\N	\N	maintenance-escalation	aaef153e-cccc-48a6-a46c-343ebab567f3	{"priority": "urgent", "actorEmail": "automation@system", "escalationStage": 2}	2026-03-11 15:24:15.105331
1b9d1d88-f146-4524-9fe7-f3f58cbd9c1d	5d4488b7-c229-4412-8762-d822e4f150f3	email	outbound	Maintenance escalation stage 3: Urgent leak	Request aaef153e-cccc-48a6-a46c-343ebab567f3 exceeded SLA response due at 2026-03-11T13:12:44.252Z.	\N	\N	maintenance-escalation	aaef153e-cccc-48a6-a46c-343ebab567f3	{"priority": "urgent", "actorEmail": "automation@system", "escalationStage": 3}	2026-03-11 15:29:14.496779
8faaf97f-c5a8-4f8b-b455-d04909f8913d	1c63e35c-2ac3-4b0a-b2ab-61f873d0d938	email	outbound	Platform Gmail Integration Test	trhhrthrthThis is a test email from the platform.	williamruiz11@gmail.com	\N	notice-send	f6ecb722-b373-4570-97aa-10f55331db1a	{"provider": "internal-mock", "providerMessageId": "mock-1773252257845"}	2026-03-11 18:04:17.849945
a475cb8d-a3ee-4dfd-930a-0618655c6095	\N	email	outbound	Platform Gmail Integration Test	This is a test email from the platform.fdfewfwef	williamruiz11@gmail.com	\N	notice-send	bba2cbfc-3272-4aa2-acde-ef0569c2586c	{"provider": "internal-mock", "providerMessageId": "mock-1773252372596"}	2026-03-11 18:06:12.600703
f48eabdf-a206-406b-8756-7a6129822d52	f301d073-ed84-4d73-84ce-3ef28af66f7a	email	outbound	Board Meeting Notice - Cherry Hill Court Condominiums	<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8"/>\n  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>\n  <title>Cherry Hill Court Condominiums</title>\n</head>\n<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:Arial,Helvetica,sans-serif;">\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;">\n  <tr>\n    <td align="center" style="padding:32px 16px;">\n      <table width="600" cellpadding="0" cellspaci	williamruiz11@gmail.com	f49f0d4b-01fd-4ea3-b8be-2d70229eb549	notice-send	1928ecf6-466a-4e22-a34b-cb86f0bf126f	{"provider": "smtp", "emailLogId": "f1486c21-cb0b-4835-a2bd-75a793cbaa37", "campaignKey": null, "errorMessage": null, "sendMetadata": null, "providerMessageId": "<41865cb3-099d-2bf8-10f1-6f8c9b6e70ce@yourcondomanagement.com>"}	2026-03-16 20:29:46.961744
51650156-91db-46a5-991b-a090f1aa1193	f301d073-ed84-4d73-84ce-3ef28af66f7a	email	outbound	Payment Instructions for Cherry Hill Court Condominiums	<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8"/>\n  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>\n  <title>Cherry Hill Court Condominiums</title>\n</head>\n<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:Arial,Helvetica,sans-serif;">\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;">\n  <tr>\n    <td align="center" style="padding:32px 16px;">\n      <table width="600" cellpadding="0" cellspaci	williamruiz11@gmail.com	f49f0d4b-01fd-4ea3-b8be-2d70229eb549	notice-send	b21c33b2-934c-4979-8f99-04dc624dc7a0	{"provider": "smtp", "emailLogId": "b1fc2818-6d43-485f-a193-16c37fe4d391", "campaignKey": null, "errorMessage": null, "sendMetadata": null, "providerMessageId": "<23cf597e-c5e5-8bce-e341-a061d5203b4e@yourcondomanagement.com>"}	2026-03-16 21:32:17.227087
\.


--
-- Data for Name: community_announcements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.community_announcements (id, association_id, title, body, priority, author_name, published_at, expires_at, is_pinned, is_published, target_audience, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: compliance_alert_overrides; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.compliance_alert_overrides (id, association_id, template_id, template_item_id, status, suppression_reason, suppressed_until, notes, created_by, updated_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: contact_update_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.contact_update_requests (id, association_id, portal_access_id, person_id, request_json, review_status, reviewed_by, reviewed_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: delinquency_escalations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.delinquency_escalations (id, association_id, person_id, unit_id, current_stage, balance, days_past_due, status, last_notice_at, next_action_at, resolved_at, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: delinquency_thresholds; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.delinquency_thresholds (id, association_id, stage, stage_name, minimum_balance, minimum_days_overdue, action_type, notice_template_id, late_fee_pct, late_fee_flat, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: document_tags; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.document_tags (id, document_id, entity_type, entity_id, created_at) FROM stdin;
\.


--
-- Data for Name: document_versions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.document_versions (id, document_id, version_number, title, file_url, uploaded_by, created_at) FROM stdin;
fa7008fb-c528-4136-a972-46ee2eeb1a9e	2668afe8-a4c3-4851-8a40-eb06a03796a3	1	Owner Packet A	/api/uploads/a.pdf	m5-verify-1772907779277@local	2026-03-07 18:22:59.369814
9ba2a30c-719b-4892-9c45-30ec05d9835b	21f6b518-5a35-49ab-970d-f062da70acb7	1	Owner Packet B	/api/uploads/b.pdf	m5-verify-1772907779277@local	2026-03-07 18:22:59.380009
4d1170a5-0680-4c2a-b6be-7601bc5b5788	fc570ce4-cfc6-4b37-933c-7b5afe602ec7	1	Owner Packet A	/api/uploads/a.pdf	m5-verify-1772907792763@local	2026-03-07 18:23:12.844936
f45f1f6e-4d0d-4d3f-8e2c-4654a1d68c59	f4d36290-993b-4e78-a0c9-71de870b4190	1	Owner Packet B	/api/uploads/b.pdf	m5-verify-1772907792763@local	2026-03-07 18:23:12.854385
641a63e5-be50-476c-a377-0555d64513c1	eb887f00-0d0d-464b-8db1-3d8818d67df8	1	Owner Packet A	/api/uploads/a.pdf	m5-verify-1772908684646@local	2026-03-07 18:38:04.733854
44df6bc5-ad02-4ac9-b339-d6010530f280	84135731-642f-472d-9c93-795c539a1f63	1	Owner Packet B	/api/uploads/b.pdf	m5-verify-1772908684646@local	2026-03-07 18:38:04.743263
e3b3f2bb-0adf-411f-b230-a021bdc902ac	6017c843-3e44-4b47-9cdc-2becc0160be3	1	Second Pass Upload	/api/uploads/1772920877166-613430235.txt	admin@local	2026-03-07 22:01:17.173214
126d5d33-932b-445d-9ab8-bb8f97eef458	dff4fe33-2ebb-4784-aeac-234a6a1050db	1	CHC Bylaws	/api/uploads/1773680081933-729318237.pdf	William Ruiz	2026-03-16 16:54:42.413823
4fcdde69-ea04-4ebb-9770-878888fdb4a7	57c9c8bd-2472-4521-9374-d70515b41b9b	1	CHC CT SOT Incorporation	/api/uploads/1773755295172-457800801.pdf	William Ruiz	2026-03-17 13:48:15.889651
d8e5e9da-e0f8-4bae-bd7d-c8e3cc5bfd0d	1f844ff3-d406-493b-8b56-bd359d6d23df	1	CHC Declaration	/api/uploads/1773755335727-687250294.pdf	William Ruiz	2026-03-17 13:48:55.964457
\.


--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.documents (id, association_id, title, file_url, document_type, uploaded_by, created_at, is_portal_visible, portal_audience) FROM stdin;
dff4fe33-2ebb-4784-aeac-234a6a1050db	f301d073-ed84-4d73-84ce-3ef28af66f7a	CHC Bylaws	/api/uploads/1773680081933-729318237.pdf	Bylaws	William Ruiz	2026-03-16 16:54:42.406262	0	owner
57c9c8bd-2472-4521-9374-d70515b41b9b	f301d073-ed84-4d73-84ce-3ef28af66f7a	CHC CT SOT Incorporation	/api/uploads/1773755295172-457800801.pdf	Legal	William Ruiz	2026-03-17 13:48:15.884831	0	owner
1f844ff3-d406-493b-8b56-bd359d6d23df	f301d073-ed84-4d73-84ce-3ef28af66f7a	CHC Declaration	/api/uploads/1773755335727-687250294.pdf	Legal	William Ruiz	2026-03-17 13:48:55.930718	0	owner
\.


--
-- Data for Name: email_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.email_events (id, email_log_id, event_type, url, ip_address, user_agent, occurred_at) FROM stdin;
\.


--
-- Data for Name: email_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.email_logs (id, association_id, to_address, cc_addresses, bcc_addresses, subject, template_key, status, provider, provider_message_id, error_message, metadata_json, tracking_token, sent_at, created_at, updated_at) FROM stdin;
110ffe23-df2d-4358-b602-96c12c892a72	\N	williamruiz11@gmail.com	[]	[]	Platform Email Integration Test	\N	sent	smtp	<670cdb5a-1e9f-377b-937f-ce0f0cf21fec@yourcondomanagement.com>	\N	\N	\N	2026-03-11 21:19:55.152	2026-03-11 21:19:53.240183	2026-03-11 21:19:55.152
0bd25125-d6f0-4f51-a1e5-be7659752e86	f301d073-ed84-4d73-84ce-3ef28af66f7a	invite-send-check@example.com	[]	[]	Cherry Hill Court Condominiums onboarding for Unit A	onboarding-invite	sent	smtp	<33f8a11e-c497-f989-7813-0dedc9657bbb@yourcondomanagement.com>	\N	{"unitId": "34575428-ea77-4013-bd0f-593e0c7dbbbb", "residentType": "tenant", "onboardingInviteId": "eaae054b-f50f-4563-84ed-35bce989060e"}	aa33b248-4af7-4557-938d-013fccc5d6a5	2026-03-14 15:02:42.857	2026-03-14 15:02:42.098929	2026-03-14 15:02:42.857
90160d48-c2b1-427a-b831-2fca9e206d1c	f301d073-ed84-4d73-84ce-3ef28af66f7a	sweep-b@example.com	[]	[]	Cherry Hill Court Condominiums onboarding for Unit A	onboarding-invite	sent	smtp	<f01573f1-dd73-92f6-9edf-73dbfd892fed@yourcondomanagement.com>	\N	{"unitId": "34575428-ea77-4013-bd0f-593e0c7dbbbb", "residentType": "tenant", "onboardingInviteId": "7d3491e1-96ff-40c5-ada3-0a6416c5d432"}	07a0493f-c9b8-4218-b14e-0857c3d1508f	2026-03-14 15:04:20.146	2026-03-14 15:04:19.451782	2026-03-14 15:04:20.146
8813b145-2815-47e7-a853-76c759359ba3	f301d073-ed84-4d73-84ce-3ef28af66f7a	sweep-a@example.com	[]	[]	Cherry Hill Court Condominiums onboarding for Unit A	onboarding-invite	sent	smtp	<4ee1392f-3c64-9202-3aa6-3f0d90e341a2@yourcondomanagement.com>	\N	{"unitId": "34575428-ea77-4013-bd0f-593e0c7dbbbb", "residentType": "owner", "onboardingInviteId": "a37e9827-b870-450b-abc4-57ddbee6057b"}	30ccd48a-1307-4ccd-9fa4-40cefbbbc6cd	2026-03-14 15:04:20.592	2026-03-14 15:04:20.164981	2026-03-14 15:04:20.592
f1486c21-cb0b-4835-a2bd-75a793cbaa37	f301d073-ed84-4d73-84ce-3ef28af66f7a	williamruiz11@gmail.com	[]	[]	Board Meeting Notice - Cherry Hill Court Condominiums	833de934-60fe-4d1b-9449-13e70146c95f	sent	smtp	<41865cb3-099d-2bf8-10f1-6f8c9b6e70ce@yourcondomanagement.com>	\N	{"campaignKey": null, "noticeSendId": "1928ecf6-466a-4e22-a34b-cb86f0bf126f", "recipientPersonId": "f49f0d4b-01fd-4ea3-b8be-2d70229eb549"}	37fc7729-ce17-49e8-9a4d-689468280111	2026-03-16 20:29:46.953	2026-03-16 20:29:46.114212	2026-03-16 20:29:46.953
b1fc2818-6d43-485f-a193-16c37fe4d391	f301d073-ed84-4d73-84ce-3ef28af66f7a	williamruiz11@gmail.com	[]	[]	Payment Instructions for Cherry Hill Court Condominiums	f243fc22-039a-468e-8cfd-4f55a8aaa7e9	sent	smtp	<23cf597e-c5e5-8bce-e341-a061d5203b4e@yourcondomanagement.com>	\N	{"campaignKey": null, "noticeSendId": "b21c33b2-934c-4979-8f99-04dc624dc7a0", "recipientPersonId": "f49f0d4b-01fd-4ea3-b8be-2d70229eb549"}	e06f7b6d-b807-4640-bf36-41fd3f2c3b6e	2026-03-16 21:32:17.215	2026-03-16 21:32:16.473723	2026-03-16 21:32:17.215
\.


--
-- Data for Name: email_threads; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.email_threads (id, association_id, subject, participants_json, source, last_message_at, created_at, updated_at) FROM stdin;
a61c5c44-5079-4acd-ad04-ab35cb62ffd0	5d4488b7-c229-4412-8762-d822e4f150f3	Payment Setup Instructions	["qa-owner-364067@example.com"]	internal	2026-03-11 14:12:44.236	2026-03-11 14:12:44.236548	2026-03-11 14:12:44.236
3b7fbe9c-afb3-41ce-aa28-6040b9fbe907	1c63e35c-2ac3-4b0a-b2ab-61f873d0d938	Platform Gmail Integration Test	["williamruiz11@gmail.com"]	internal	2026-03-11 18:04:17.855	2026-03-11 18:04:17.855719	2026-03-11 18:04:17.855
08cc6ce0-38d9-45a2-8e88-dd53e2de2684	f301d073-ed84-4d73-84ce-3ef28af66f7a	Cherry Hill Court Condominiums onboarding for Unit A	["invite-send-check@example.com", "sweep-b@example.com", "sweep-a@example.com"]	internal	2026-03-14 15:04:20.608	2026-03-14 15:02:42.877535	2026-03-14 15:04:20.608
660977da-fd8d-4e8a-a226-e97ecd478ab5	f301d073-ed84-4d73-84ce-3ef28af66f7a	Board Meeting Notice - Cherry Hill Court Condominiums	["williamruiz11@gmail.com"]	internal	2026-03-16 20:29:46.965	2026-03-16 20:29:46.966047	2026-03-16 20:29:46.965
793d1209-aea6-4d06-8d61-d68a0e7bd5b9	f301d073-ed84-4d73-84ce-3ef28af66f7a	Payment Instructions for Cherry Hill Court Condominiums	["williamruiz11@gmail.com"]	internal	2026-03-16 21:32:17.241	2026-03-16 21:32:17.241998	2026-03-16 21:32:17.241
\.


--
-- Data for Name: expense_attachments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.expense_attachments (id, association_id, expense_type, expense_id, title, file_url, uploaded_by, created_at) FROM stdin;
\.


--
-- Data for Name: feature_flags; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.feature_flags (id, key, name, description, default_enabled, rollout_status, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: financial_accounts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.financial_accounts (id, association_id, name, account_code, account_type, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: financial_alerts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.financial_alerts (id, association_id, alert_type, severity, title, message, entity_type, entity_id, amount, is_read, is_dismissed, dismissed_by, dismissed_at, created_at) FROM stdin;
\.


--
-- Data for Name: financial_approvals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.financial_approvals (id, association_id, requested_by, approver_id, status, change_type, change_description, change_amount, change_payload_json, required_approvers, approved_by, resolved_at, resolver_notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: financial_categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.financial_categories (id, association_id, name, category_type, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: governance_compliance_templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.governance_compliance_templates (id, association_id, scope, year, name, created_by, created_at, updated_at, base_template_id, state_code, version_number, source_authority, source_url, source_document_title, source_document_date, effective_date, last_source_updated_at, last_verified_at, last_synced_at, next_review_due_at, publication_status, published_at, review_notes) FROM stdin;
\.


--
-- Data for Name: governance_meetings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.governance_meetings (id, association_id, meeting_type, title, scheduled_at, location, status, agenda, notes, summary_text, summary_status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: governance_reminder_rules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.governance_reminder_rules (id, association_id, name, trigger, days_offset, recipient_type, subject_template, body_template, meeting_types, is_active, last_run_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: governance_template_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.governance_template_items (id, template_id, title, description, due_month, due_day, order_index, created_at, legal_reference, source_citation, source_url) FROM stdin;
\.


--
-- Data for Name: hoa_fee_schedules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.hoa_fee_schedules (id, association_id, name, amount, frequency, start_date, end_date, grace_days, is_active, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: inspection_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inspection_records (id, association_id, unit_id, location_type, location_text, inspection_type, inspector_name, overall_condition, summary, inspected_at, findings_json, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: late_fee_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.late_fee_events (id, association_id, rule_id, reference_type, reference_id, balance_amount, due_date, as_of_date, calculated_fee, created_at) FROM stdin;
\.


--
-- Data for Name: late_fee_rules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.late_fee_rules (id, association_id, name, fee_type, fee_amount, grace_days, max_fee, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: maintenance_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.maintenance_requests (id, association_id, unit_id, submitted_by_person_id, submitted_by_portal_access_id, submitted_by_email, title, description, location_text, category, priority, status, attachment_urls_json, assigned_to, resolution_notes, response_due_at, escalation_stage, escalated_at, last_escalation_notice_at, triaged_at, resolved_at, closed_at, created_at, updated_at) FROM stdin;
aaef153e-cccc-48a6-a46c-343ebab567f3	5d4488b7-c229-4412-8762-d822e4f150f3	355b724f-3596-4565-8dfd-a5c9f4b5a9fb	23a44250-f9b2-42a0-ba62-b3ef119a8f54	\N	qa-owner-364067@example.com	Urgent leak	Water leak in ceiling near bathroom vent.	Unit QA-364067	plumbing	urgent	submitted	[]	\N	\N	2026-03-11 13:12:44.252	3	2026-03-11 15:29:14.475	2026-03-11 15:29:14.475	\N	\N	\N	2026-03-11 14:12:44.239741	2026-03-11 15:29:14.475
\.


--
-- Data for Name: maintenance_schedule_instances; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.maintenance_schedule_instances (id, template_id, association_id, unit_id, vendor_id, work_order_id, title, component, location_text, due_at, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: maintenance_schedule_templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.maintenance_schedule_templates (id, association_id, unit_id, vendor_id, title, component, description, location_text, frequency_unit, frequency_interval, responsible_party, auto_create_work_order, next_due_at, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: meeting_agenda_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.meeting_agenda_items (id, meeting_id, title, description, order_index, created_at) FROM stdin;
1077fd8d-b3a0-446b-83eb-ff666ff99f77	9676ea3c-144d-48c7-8ab8-ff94e4bed136	Adopt annual policy	Discuss and vote	1	2026-03-07 18:04:58.068506
1dd98d0c-594f-4170-b803-2be9250717cb	61b91342-8ed1-4c4e-b03e-2925a69f121b	Adopt annual policy	Discuss and vote	1	2026-03-07 18:37:42.83769
\.


--
-- Data for Name: meeting_notes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.meeting_notes (id, meeting_id, note_type, content, created_by, created_at, updated_at) FROM stdin;
579fb5c8-a507-43e5-a61a-dd1b46204c92	9676ea3c-144d-48c7-8ab8-ff94e4bed136	minutes	Discussion opened with quorum present.	m3-verify-1772906698033@local	2026-03-07 18:04:58.075222	2026-03-07 18:04:58.074
40c158c3-9197-4f27-91dd-02de23fb7326	61b91342-8ed1-4c4e-b03e-2925a69f121b	minutes	Discussion opened with quorum present.	m3-verify-1772908662803@local	2026-03-07 18:37:42.841509	2026-03-07 18:37:42.84
\.


--
-- Data for Name: notice_sends; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notice_sends (id, association_id, template_id, recipient_email, recipient_person_id, subject_rendered, body_rendered, status, provider, provider_message_id, sent_by, sent_at, campaign_key, metadata_json, delivered_at, opened_at, bounced_at, bounce_type, bounce_reason, retry_count, last_retry_at) FROM stdin;
f60772c5-6e5f-4d9f-a49b-98e899005679	5d4488b7-c229-4412-8762-d822e4f150f3	\N	qa-owner-364067@example.com	23a44250-f9b2-42a0-ba62-b3ef119a8f54	Payment Setup Instructions	Methods:\n1. ACH Transfer: Use routing 011000015 and account 123456789.\nSupport: billing@example.com	sent	internal-mock	mock-1773238364226	qa-approver@local	2026-03-11 14:12:44.226	\N	\N	\N	\N	\N	\N	\N	0	\N
f6ecb722-b373-4570-97aa-10f55331db1a	1c63e35c-2ac3-4b0a-b2ab-61f873d0d938	\N	williamruiz11@gmail.com	\N	Platform Gmail Integration Test	trhhrthrthThis is a test email from the platform.	sent	internal-mock	mock-1773252257845	admin@local	2026-03-11 18:04:17.845	\N	\N	\N	\N	\N	\N	\N	0	\N
bba2cbfc-3272-4aa2-acde-ef0569c2586c	\N	\N	williamruiz11@gmail.com	\N	Platform Gmail Integration Test	This is a test email from the platform.fdfewfwef	sent	internal-mock	mock-1773252372596	admin@local	2026-03-11 18:06:12.596	\N	\N	\N	\N	\N	\N	\N	0	\N
1928ecf6-466a-4e22-a34b-cb86f0bf126f	f301d073-ed84-4d73-84ce-3ef28af66f7a	833de934-60fe-4d1b-9449-13e70146c95f	williamruiz11@gmail.com	f49f0d4b-01fd-4ea3-b8be-2d70229eb549	Board Meeting Notice - Cherry Hill Court Condominiums	<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8"/>\n  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>\n  <title>Cherry Hill Court Condominiums</title>\n</head>\n<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:Arial,Helvetica,sans-serif;">\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;">\n  <tr>\n    <td align="center" style="padding:32px 16px;">\n      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.10);">\n        <tr>\n          <td style="background-color:#1e3a5f;padding:28px 36px;">\n            <div style="color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:0.01em;margin-bottom:6px;">Cherry Hill Court Condominiums</div>\n            <div style="color:#a8c4e0;font-size:13px;">1405 Quinnipiac Ave., New Haven, CT</div>\n          </td>\n        </tr>\n        <tr>\n          <td style="background-color:#e8eef4;padding:10px 36px;border-bottom:2px solid #1e3a5f;">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td style="color:#1e3a5f;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;">Official Community Notice</td>\n                <td align="right" style="color:#666666;font-size:11px;">March 16, 2026</td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n        <tr>\n          <td style="padding:32px 36px;background-color:#ffffff;">\n            <p style="margin:0 0 14px 0;color:#333333;font-size:15px;line-height:1.65;">Association: Cherry Hill Court Condominiums</p><hr style="border:none;border-top:1px solid #eeeeee;margin:20px 0;" /><p style="margin:0 0 14px 0;color:#333333;font-size:15px;line-height:1.65;">Hello,</p><p style="margin:0 0 14px 0;color:#333333;font-size:15px;line-height:1.65;">This is notice of an upcoming board meeting for Cherry Hill Court Condominiums.</p><p style="margin:0 0 14px 0;color:#333333;font-size:15px;line-height:1.65;">Date and agenda details will be posted in your resident portal.</p><p style="margin:0 0 14px 0;color:#333333;font-size:15px;line-height:1.65;">Thank you,<br/>Cherry Hill Court Condominiums</p><hr style="border:none;border-top:1px solid #eeeeee;margin:20px 0;" /><p style="margin:0 0 14px 0;color:#333333;font-size:15px;line-height:1.65;">Unit: B</p><hr style="border:none;border-top:1px solid #eeeeee;margin:20px 0;" /><p style="margin:0 0 14px 0;color:#333333;font-size:15px;line-height:1.65;">Cherry Hill Court Condominiums Board</p>\n          </td>\n        </tr>\n        <tr>\n          <td style="padding:20px 36px;background-color:#f8f9fa;border-top:1px solid #e0e0e0;">\n            <p style="margin:0;color:#888888;font-size:12px;line-height:1.6;">\n              This notice was sent by <strong>Cherry Hill Court Condominiums</strong>.\n            </p>\n          </td>\n        </tr>\n      </table>\n    </td>\n  </tr>\n</table>\n</body>\n</html>	sent	smtp	<41865cb3-099d-2bf8-10f1-6f8c9b6e70ce@yourcondomanagement.com>	admin@local	2026-03-16 20:29:46.112	\N	\N	\N	\N	\N	\N	\N	0	\N
b21c33b2-934c-4979-8f99-04dc624dc7a0	f301d073-ed84-4d73-84ce-3ef28af66f7a	f243fc22-039a-468e-8cfd-4f55a8aaa7e9	williamruiz11@gmail.com	f49f0d4b-01fd-4ea3-b8be-2d70229eb549	Payment Instructions for Cherry Hill Court Condominiums	<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8"/>\n  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>\n  <title>Cherry Hill Court Condominiums</title>\n</head>\n<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:Arial,Helvetica,sans-serif;">\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;">\n  <tr>\n    <td align="center" style="padding:32px 16px;">\n      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.10);">\n        <tr>\n          <td style="background-color:#1e3a5f;padding:28px 36px;">\n            <div style="color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:0.01em;margin-bottom:6px;">Cherry Hill Court Condominiums</div>\n            <div style="color:#a8c4e0;font-size:13px;">1405 Quinnipiac Ave., New Haven, CT</div>\n          </td>\n        </tr>\n        <tr>\n          <td style="background-color:#e8eef4;padding:10px 36px;border-bottom:2px solid #1e3a5f;">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td style="color:#1e3a5f;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;">\n                  Official Community Notice &nbsp;&middot;&nbsp; <span style="font-weight:normal;text-transform:none;">1421, Unit B</span>\n                </td>\n                <td align="right" style="color:#666666;font-size:11px;">March 16, 2026</td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n        <tr>\n          <td style="padding:32px 36px;background-color:#ffffff;">\n            <p style="margin:0 0 14px 0;color:#333333;font-size:15px;line-height:1.65;">Association: Cherry Hill Court Condominiums</p><hr style="border:none;border-top:1px solid #eeeeee;margin:20px 0;" /><p style="margin:0 0 14px 0;color:#333333;font-size:15px;line-height:1.65;">Hello William Ruiz,</p><p style="margin:0 0 14px 0;color:#333333;font-size:15px;line-height:1.65;">Please use the approved payment methods below for your account.</p><p style="margin:0 0 14px 0;color:#333333;font-size:15px;line-height:1.65;">{{payment_methods}}</p><p style="margin:0 0 14px 0;color:#333333;font-size:15px;line-height:1.65;">If you have questions, contact {{payment_support_email}} or {{payment_support_phone}}.</p><p style="margin:0 0 14px 0;color:#333333;font-size:15px;line-height:1.65;">Thank you,<br/>Cherry Hill Court Condominiums</p><hr style="border:none;border-top:1px solid #eeeeee;margin:20px 0;" /><p style="margin:0 0 14px 0;color:#333333;font-size:15px;line-height:1.65;">This notice applies to unit B.</p><hr style="border:none;border-top:1px solid #eeeeee;margin:20px 0;" /><p style="margin:0 0 14px 0;color:#333333;font-size:15px;line-height:1.65;">Cherry Hill Court Condominiums Management</p>\n          </td>\n        </tr>\n        <tr>\n          <td style="padding:20px 36px;background-color:#f8f9fa;border-top:1px solid #e0e0e0;">\n            <p style="margin:0;color:#888888;font-size:12px;line-height:1.6;">\n              This notice was sent by <strong>Cherry Hill Court Condominiums</strong>.\n            </p>\n          </td>\n        </tr>\n        <tr>\n          <td style="padding:10px 36px;background-color:#f0f2f5;border-top:1px solid #e8eaed;text-align:center;">\n            <p style="margin:0;color:#bbbbbb;font-size:11px;letter-spacing:0.02em;">Powered by <span style="color:#9aaabb;">Your Condo Manager</span></p>\n          </td>\n        </tr>\n      </table>\n    </td>\n  </tr>\n</table>\n</body>\n</html>	sent	smtp	<23cf597e-c5e5-8bce-e341-a061d5203b4e@yourcondomanagement.com>	admin@local	2026-03-16 21:32:16.471	\N	\N	\N	\N	\N	\N	\N	0	\N
\.


--
-- Data for Name: notice_templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notice_templates (id, association_id, name, channel, subject_template, body_template, is_active, created_at, updated_at, header_template, footer_template, signature_template) FROM stdin;
f243fc22-039a-468e-8cfd-4f55a8aaa7e9	f301d073-ed84-4d73-84ce-3ef28af66f7a	Payment Instructions - Standard	email	Payment Instructions for {{association_name}}	Hello {{owner_name}},\n\nPlease use the approved payment methods below for your account.\n\n{{payment_methods}}\n\nIf you have questions, contact {{payment_support_email}} or {{payment_support_phone}}.\n\nThank you,\n{{association_name}}	1	2026-03-16 20:28:29.932875	2026-03-16 20:28:29.932	Association: {{association_name}}	This notice applies to unit {{unit_number}}.	{{association_name}} Management
833de934-60fe-4d1b-9449-13e70146c95f	f301d073-ed84-4d73-84ce-3ef28af66f7a	Board Meeting Notice - Standard	email	Board Meeting Notice - {{association_name}}	Hello,\n\nThis is notice of an upcoming board meeting for {{association_name}}.\n\nDate and agenda details will be posted in your resident portal.\n\nThank you,\n{{association_name}}	1	2026-03-16 20:28:29.936355	2026-03-16 20:28:29.935	Association: {{association_name}}	Unit: {{unit_number}}	{{association_name}} Board
8341030d-6060-4253-84b0-f9f1f8f3ed7b	f301d073-ed84-4d73-84ce-3ef28af66f7a	Maintenance Update - Standard	email	Maintenance Update for {{unit_number}}	Hello,\n\nWe are providing an update related to maintenance activity for unit {{unit_number}}.\n\nFor request details use: {{maintenance_request_link}}\n\nThank you,\n{{association_name}}	1	2026-03-16 20:28:29.936992	2026-03-16 20:28:29.936	Association: {{association_name}}	\N	{{association_name}} Operations
\.


--
-- Data for Name: occupancies; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.occupancies (id, unit_id, person_id, occupancy_type, start_date, end_date) FROM stdin;
6dc1a27d-c73c-47e8-976b-d222fba075d8	355b724f-3596-4565-8dfd-a5c9f4b5a9fb	23a44250-f9b2-42a0-ba62-b3ef119a8f54	OWNER_OCCUPIED	2026-03-11 14:12:44.148	\N
46b12533-2da1-4410-9c84-94f081180df3	f5d74705-ef3d-439d-bf89-a2c1c2a17f34	bc4206ca-98dc-4284-9493-b874420e4374	TENANT	2017-06-01 00:00:00	\N
ef8df4e8-3f41-4d1e-b921-20567a8a18dd	3d308aff-6712-4628-b812-e247c38ab92b	e64948e9-e5e2-4504-aae3-3023701d7602	TENANT	2016-12-01 00:00:00	\N
14887307-beef-4fbf-97e5-fa6b1f305072	a5b46109-1514-4207-9ed3-2b587ead617f	c20a508c-c0a1-42dc-8bee-4c7afd45d117	TENANT	2021-11-30 00:00:00	\N
85d231e4-2f3d-4699-9147-760056adfa75	341b2050-28cf-4d3d-bc44-ef5a0f6584d9	5dd27a32-c1ee-4826-bf18-db9df778eea3	OWNER_OCCUPIED	2010-07-10 00:00:00	\N
8b37fbe8-b1de-4534-9845-f763f8e83ad5	91e77ac7-b0dc-4bab-a169-f167b20e5cce	acf06065-a75c-45ab-9c55-b5fddecef158	TENANT	2018-09-27 00:00:00	\N
2d3816ee-1f7a-4739-8524-84dd435c0058	53655499-8ae3-4afc-b9d1-44e7b237f3bd	39a0b470-42dc-47e3-a009-3acb4ae84f28	OWNER_OCCUPIED	2020-03-15 00:00:00	\N
7fe9f2ef-02e0-450c-afd4-42f2fa07f1b6	5ee388f3-1d23-47a8-a232-295980277fdf	38abdc09-7717-49d7-b8c8-79967435dd93	TENANT	2023-01-01 00:00:00	\N
d5c0c743-9e5e-46c1-8dc7-82bd5bfd2d40	d68208db-8df2-4d80-b59c-85d43bc3c6d6	0d78d695-6a3a-47ca-adc6-591c6c7a733c	OWNER_OCCUPIED	2019-08-20 00:00:00	\N
98481eb1-4a49-47f2-a9ce-a5480a090ff0	71d07510-9193-4bf9-a814-e6a1498e2cf0	6aa1ff35-a949-409b-8adc-fc354e493d4f	OWNER_OCCUPIED	2018-11-05 00:00:00	\N
86d20d1c-f230-4c27-a663-ddd60adf4983	909ed4e8-fb53-49f8-aecf-5b56c10e1e30	5c600f8c-c59d-49ae-bdcd-94c8ef1c4625	OWNER_OCCUPIED	2026-03-16 00:00:00	\N
01dcb395-e2fb-46b1-88a3-8afc4de68de1	7adb3521-845b-41de-8054-3281ddfc0f3c	2fcd7d8c-13c0-4d5b-96d3-0f2ec2131c65	TENANT	2026-03-17 14:25:52.599	\N
\.


--
-- Data for Name: onboarding_invites; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.onboarding_invites (id, association_id, unit_id, resident_type, email, phone, delivery_channel, token, status, expires_at, created_by, last_sent_at, submitted_at, approved_at, rejected_at, revoked_at, created_at, updated_at) FROM stdin;
61416ad0-91a4-4616-85d5-db9739019556	f301d073-ed84-4d73-84ce-3ef28af66f7a	341b2050-28cf-4d3d-bc44-ef5a0f6584d9	owner	\N	\N	unit-link	RknsX4OM-mQ7ch7hCreM7fDWcgicQ4U3	approved	\N	admin@local	2026-03-16 20:44:29.84	2026-03-16 21:24:39.884	2026-03-16 22:52:54.492	\N	\N	2026-03-16 20:44:29.841816	2026-03-16 22:52:54.492
ddcf26dc-e302-4f2c-9080-cee71d225340	f301d073-ed84-4d73-84ce-3ef28af66f7a	7adb3521-845b-41de-8054-3281ddfc0f3c	owner	\N	\N	unit-link	GK6XgfeOgDt02Fx7uR3hxpuUJT48J7ma	active	\N	admin@local	2026-03-16 16:47:12.84	\N	\N	\N	\N	2026-03-16 16:47:12.842118	2026-03-16 16:47:12.84
9dd3be69-030e-4e58-92a2-83714efbafa7	f301d073-ed84-4d73-84ce-3ef28af66f7a	909ed4e8-fb53-49f8-aecf-5b56c10e1e30	tenant	\N	\N	unit-link	ca71knZcD9ExXTbNDrWBzJDQI2X43OVu	active	\N	admin@local	2026-03-16 16:47:26.426	\N	\N	\N	\N	2026-03-16 16:47:26.42659	2026-03-16 16:47:26.426
4b546d84-ed82-4b74-b4c0-b9600ac8560a	f301d073-ed84-4d73-84ce-3ef28af66f7a	91e77ac7-b0dc-4bab-a169-f167b20e5cce	owner	\N	\N	unit-link	4DqBEldhmYrF64xjeHAoT_ta378MnZOn	approved	\N	admin@local	2026-03-16 20:47:09.666	2026-03-16 22:29:29.254	2026-03-16 22:52:55.668	\N	\N	2026-03-16 20:47:09.666994	2026-03-16 22:52:55.668
946fbd88-4240-455a-a76b-97ebac0f89d5	f301d073-ed84-4d73-84ce-3ef28af66f7a	909ed4e8-fb53-49f8-aecf-5b56c10e1e30	owner	\N	\N	unit-link	WA4kkn39yFIFfS33Dz3Ee08P3B4xoKzh	rejected	\N	admin@local	2026-03-16 17:06:57.842	2026-03-16 17:08:34.993	\N	2026-03-16 17:09:12.451	\N	2026-03-16 17:06:57.844224	2026-03-16 17:09:12.451
67e498fe-8e43-4a7f-9da2-64390c093cd0	f301d073-ed84-4d73-84ce-3ef28af66f7a	bfa54c14-9fcd-4ed4-a810-61f193aa7d4b	owner	\N	\N	unit-link	qFTJMfoccxCvWwVG0RAHlfqkTU-pP4M0	active	\N	admin@local	2026-03-16 18:57:15.55	\N	\N	\N	\N	2026-03-16 18:57:15.551768	2026-03-16 18:57:15.55
4c9faf8c-5c9d-41a7-be75-5cdc790e2d4e	f301d073-ed84-4d73-84ce-3ef28af66f7a	f5d74705-ef3d-439d-bf89-a2c1c2a17f34	owner	\N	\N	unit-link	UVeVon3Xrzucs7EHAyC3V8veI-MDzpe3	approved	\N	admin@local	2026-03-16 19:07:49.38	2026-03-16 19:43:04.808	2026-03-16 19:44:33.927	\N	\N	2026-03-16 19:07:49.38078	2026-03-16 19:44:33.927
fcec780c-9e57-4321-af13-08fed500f5d3	f301d073-ed84-4d73-84ce-3ef28af66f7a	b1f60b15-3cec-4cca-8c1c-0a0ba7bf4d7f	owner	\N	\N	unit-link	m5OWJlecO_ZPtAgOimrTjMKs5sJYhE1z	active	\N	admin@local	2026-03-16 19:45:24.156	\N	\N	\N	\N	2026-03-16 19:45:24.157377	2026-03-16 19:45:24.156
73aaa95c-d64d-4664-b804-357457c6b4f5	f301d073-ed84-4d73-84ce-3ef28af66f7a	909ed4e8-fb53-49f8-aecf-5b56c10e1e30	owner	\N	\N	unit-link	qagn0IbxT2OBu8T8qJMouInQEA9LTY1Z	approved	\N	admin@local	2026-03-16 20:44:03.118	2026-03-16 23:13:24.324	2026-03-17 01:21:02.741	\N	\N	2026-03-16 20:44:03.119473	2026-03-17 01:21:02.741
8e7c01ac-7c2d-46f6-96fd-8a23e3d3e852	f301d073-ed84-4d73-84ce-3ef28af66f7a	3d308aff-6712-4628-b812-e247c38ab92b	owner	\N	\N	unit-link	dfutdi809fiuibmhZzAltsRx-Al7YZDA	approved	\N	admin@local	2026-03-16 19:45:06.428	2026-03-16 20:17:41.814	2026-03-16 20:18:39.594	\N	\N	2026-03-16 19:45:06.429071	2026-03-16 20:18:39.594
cff0c483-0d91-4a84-9217-69a4b31c1351	f301d073-ed84-4d73-84ce-3ef28af66f7a	a5b46109-1514-4207-9ed3-2b587ead617f	owner	\N	\N	unit-link	uGMMShPhhhfoIL-ZMSSK4fQywcOGf8Za	approved	\N	admin@local	2026-03-16 19:45:38.356	2026-03-16 20:10:54.379	2026-03-16 20:18:40.879	\N	\N	2026-03-16 19:45:38.356708	2026-03-16 20:18:40.879
b8e7dde4-8750-4ebc-91b8-1a7ded105618	f301d073-ed84-4d73-84ce-3ef28af66f7a	96696dfe-9feb-439a-ba29-88b79c5a74fd	owner	\N	\N	unit-link	81mfohCmq0pbgNzHF-wbVBZfyZXKzV1K	active	\N	\N	2026-03-16 20:29:45.774	\N	\N	\N	\N	2026-03-16 20:29:45.775773	2026-03-16 20:29:45.774
66eb876a-444d-43ff-8e95-144fe2d041d0	f301d073-ed84-4d73-84ce-3ef28af66f7a	96696dfe-9feb-439a-ba29-88b79c5a74fd	tenant	\N	\N	unit-link	WLloIxDUlKP3k2ZjW8cCglPlF6wgpiNu	active	\N	\N	2026-03-16 20:29:45.908	\N	\N	\N	\N	2026-03-16 20:29:45.908878	2026-03-16 20:29:45.908
ec0fdb3c-a356-46af-a67d-13f75435f586	f301d073-ed84-4d73-84ce-3ef28af66f7a	a882cbbb-1061-4764-8b2b-d9398e2ccedb	owner	\N	\N	unit-link	w5i2ictfOvijLyhqnbZhiLs-8qQGwOi3	active	\N	admin@local	2026-03-16 20:43:19.15	\N	\N	\N	\N	2026-03-16 20:43:19.151276	2026-03-16 20:43:19.15
940a2d75-fd4e-47ed-b1e1-4184de8b3dc0	f301d073-ed84-4d73-84ce-3ef28af66f7a	978bacef-824f-471e-80ea-891a8eaa01f8	owner	\N	\N	unit-link	YFkI3IjPwwLVyrwqUQlrYNflu3OcosHi	active	\N	admin@local	2026-03-16 20:45:02.128	\N	\N	\N	\N	2026-03-16 20:45:02.128981	2026-03-16 20:45:02.128
cc309d66-c816-470e-b602-21e051ae4570	f301d073-ed84-4d73-84ce-3ef28af66f7a	968ed680-252a-4be9-ae77-9312e8a5a150	owner	\N	\N	unit-link	LLlTyVlbEnOCEx06GbN69QiSeJWV0QoS	active	\N	admin@local	2026-03-16 20:45:25.02	\N	\N	\N	\N	2026-03-16 20:45:25.021114	2026-03-16 20:45:25.02
\.


--
-- Data for Name: onboarding_submissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.onboarding_submissions (id, invite_id, association_id, unit_id, resident_type, source_channel, status, first_name, last_name, email, phone, mailing_address, emergency_contact_name, emergency_contact_phone, contact_preference, start_date, ownership_percentage, submitted_at, reviewed_by, reviewed_at, rejection_reason, created_person_id, created_occupancy_id, created_ownership_id, created_at, updated_at, occupancy_intent, additional_owners_json, tenant_residents_json) FROM stdin;
90b9600c-174d-4e41-bc66-8e184028723b	946fbd88-4240-455a-a76b-97ebac0f89d5	f301d073-ed84-4d73-84ce-3ef28af66f7a	909ed4e8-fb53-49f8-aecf-5b56c10e1e30	owner	unit-link	rejected	w	r	williamruiz11@gmail.com	2036764815	714 Blackshire Rd, Wilmington, DE, 19805	\N	\N	phone	2026-03-03 00:00:00	100	2026-03-16 17:08:34.791	admin@local	2026-03-16 17:09:12.447	Please update the submission and try again.	\N	\N	\N	2026-03-16 17:08:34.791911	2026-03-16 17:09:12.447	vacant	\N	\N
6ddb4387-b14b-4d1e-826f-282d89bba68f	4c9faf8c-5c9d-41a7-be75-5cdc790e2d4e	f301d073-ed84-4d73-84ce-3ef28af66f7a	f5d74705-ef3d-439d-bf89-a2c1c2a17f34	owner	unit-link	approved	Felipe	Pantoja	Minerva.miranda57@outlook.com	203-804-9751	1421D Quinnipiac Ave, New Haven, CT, 06513	\N	\N	email	2017-06-01 00:00:00	100	2026-03-16 19:43:04.77	admin@local	2026-03-16 19:44:33.925	\N	e64948e9-e5e2-4504-aae3-3023701d7602	\N	c0392b80-4776-4063-9867-1fb102b0fc56	2026-03-16 19:43:04.771542	2026-03-16 19:44:33.925	rental	\N	[{"email": "terriyarbrough2415@gmail.com", "phone": "203-645-1457", "lastName": "Yarbrough", "firstName": "Terri", "mailingAddress": null, "contactPreference": null, "ownershipPercentage": null, "emergencyContactName": null, "emergencyContactPhone": null}]
cefcc737-c236-4252-89bb-53084a6b3d5e	8e7c01ac-7c2d-46f6-96fd-8a23e3d3e852	f301d073-ed84-4d73-84ce-3ef28af66f7a	3d308aff-6712-4628-b812-e247c38ab92b	owner	unit-link	approved	Luz	Miranda	Minerva.miranda57@outlook.com	203-645-1457	1417 B Quinnipiac Ave, New Haven, CT, 06513	\N	\N	email	2016-12-01 00:00:00	100	2026-03-16 20:17:41.57	admin@local	2026-03-16 20:18:39.589	\N	e64948e9-e5e2-4504-aae3-3023701d7602	\N	5edbcab0-1094-47eb-a635-882fade51019	2026-03-16 20:17:41.571513	2026-03-16 20:18:39.589	rental	\N	[{"email": "minerva.miranda57@outlook.com", "phone": "293-645-1457", "lastName": "Colon", "firstName": "Heydi", "mailingAddress": null, "contactPreference": null, "ownershipPercentage": null, "emergencyContactName": null, "emergencyContactPhone": null}]
0a006fd1-fa0b-41f3-91e8-a1c38f7a9182	cff0c483-0d91-4a84-9217-69a4b31c1351	f301d073-ed84-4d73-84ce-3ef28af66f7a	a5b46109-1514-4207-9ed3-2b587ead617f	owner	unit-link	approved	Felipe	Pantoja	Minerva.miranda57@outlook.com	203-804-9751	1417 C Quinnipiac Ave, New Haven, CT, 06513	\N	\N	email	2021-11-30 00:00:00	100	2026-03-16 20:10:54.111	admin@local	2026-03-16 20:18:40.876	\N	e64948e9-e5e2-4504-aae3-3023701d7602	\N	63398896-4168-487b-9745-7c2f43a2af74	2026-03-16 20:10:54.112219	2026-03-16 20:18:40.876	rental	\N	[{"email": "Minerva.miranda57@outloo.com", "phone": "203-645-1457", "lastName": "Richards", "firstName": "Audrey", "mailingAddress": null, "contactPreference": null, "ownershipPercentage": null, "emergencyContactName": null, "emergencyContactPhone": null}]
26b53903-0340-4872-afdc-5b4d9c964fb9	61416ad0-91a4-4616-85d5-db9739019556	f301d073-ed84-4d73-84ce-3ef28af66f7a	341b2050-28cf-4d3d-bc44-ef5a0f6584d9	owner	unit-link	approved	Omar and Medea	Sanchez	joseomarsanchez77@gmail.com	2035354822	1415 Quinnipiac Ave unit c, New Haven, CT, 06513	\N	\N	email	2010-07-10 00:00:00	100	2026-03-16 21:24:39.756	yourcondomanagement@gmail.com	2026-03-16 22:52:54.48	\N	5dd27a32-c1ee-4826-bf18-db9df778eea3	85d231e4-2f3d-4699-9147-760056adfa75	29855825-d70f-4663-bd43-832a5ddde56c	2026-03-16 21:24:39.757777	2026-03-16 22:52:54.48	owner-occupied	\N	\N
4222d0d2-6af3-4efa-973b-078daf42526d	4b546d84-ed82-4b74-b4c0-b9600ac8560a	f301d073-ed84-4d73-84ce-3ef28af66f7a	91e77ac7-b0dc-4bab-a169-f167b20e5cce	owner	unit-link	approved	Stephen	TOROK	dhtorok@comcast.net	2034849006  c2034004943	1417 Quinnipiac Ave Unit G, New Haven, Connecticut, 06513	\N	\N	email	2018-09-27 00:00:00	50	2026-03-16 22:29:28.905	yourcondomanagement@gmail.com	2026-03-16 22:52:55.663	\N	3d5f7fc5-c5f6-4dcd-bfe6-cade8e8e2258	\N	e2e15920-485e-4f8c-b68b-90c35ea0230e	2026-03-16 22:29:28.906663	2026-03-16 22:52:55.663	rental	[{"email": "dhtorok@comcast.net", "phone": "2034849006 c2034004943", "lastName": "TOROK", "firstName": "Dianne", "mailingAddress": null, "contactPreference": null, "ownershipPercentage": 50, "emergencyContactName": null, "emergencyContactPhone": null}]	[{"email": "alleykat1616@gmail.com", "phone": "203 850-4758", "lastName": "TOROK", "firstName": "Allison", "mailingAddress": null, "contactPreference": null, "ownershipPercentage": null, "emergencyContactName": null, "emergencyContactPhone": null}]
3a6a8a52-5283-4b1d-9ad6-1308a179f705	73aaa95c-d64d-4664-b804-357457c6b4f5	f301d073-ed84-4d73-84ce-3ef28af66f7a	909ed4e8-fb53-49f8-aecf-5b56c10e1e30	owner	unit-link	approved	Gloria	Achigasim	Gachigasim@gmail.com	2032093642	1415b Quinnipiac Ave, New Haven, CT, 06513	\N	\N	email	2026-03-16 00:00:00	100	2026-03-16 23:13:24.285	yourcondomanagement@gmail.com	2026-03-17 01:21:02.738	\N	5c600f8c-c59d-49ae-bdcd-94c8ef1c4625	86d20d1c-f230-4c27-a663-ddd60adf4983	97a7487f-fe9e-4f4e-931b-681bc5d3108d	2026-03-16 23:13:24.285729	2026-03-17 01:21:02.738	owner-occupied	\N	\N
\.


--
-- Data for Name: owner_ledger_entries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.owner_ledger_entries (id, association_id, unit_id, person_id, entry_type, amount, posted_at, description, reference_type, reference_id, created_at) FROM stdin;
\.


--
-- Data for Name: owner_payment_links; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.owner_payment_links (id, token, association_id, unit_id, person_id, amount, currency, status, allow_partial, memo, expires_at, paid_at, voided_at, metadata_json, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: ownerships; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ownerships (id, unit_id, person_id, ownership_percentage, start_date, end_date) FROM stdin;
00a8ed6f-7d34-4e97-b309-c779a31c85ca	355b724f-3596-4565-8dfd-a5c9f4b5a9fb	23a44250-f9b2-42a0-ba62-b3ef119a8f54	100	2026-03-11 14:12:44.148	\N
4593d79c-1100-41e5-ab04-c1430c710bc9	96696dfe-9feb-439a-ba29-88b79c5a74fd	f49f0d4b-01fd-4ea3-b8be-2d70229eb549	100	2026-03-16 18:21:29.196	\N
c0392b80-4776-4063-9867-1fb102b0fc56	f5d74705-ef3d-439d-bf89-a2c1c2a17f34	e64948e9-e5e2-4504-aae3-3023701d7602	100	2017-06-01 00:00:00	\N
5edbcab0-1094-47eb-a635-882fade51019	3d308aff-6712-4628-b812-e247c38ab92b	e64948e9-e5e2-4504-aae3-3023701d7602	100	2016-12-01 00:00:00	\N
63398896-4168-487b-9745-7c2f43a2af74	a5b46109-1514-4207-9ed3-2b587ead617f	e64948e9-e5e2-4504-aae3-3023701d7602	100	2021-11-30 00:00:00	\N
29855825-d70f-4663-bd43-832a5ddde56c	341b2050-28cf-4d3d-bc44-ef5a0f6584d9	5dd27a32-c1ee-4826-bf18-db9df778eea3	100	2010-07-10 00:00:00	\N
e2e15920-485e-4f8c-b68b-90c35ea0230e	91e77ac7-b0dc-4bab-a169-f167b20e5cce	3d5f7fc5-c5f6-4dcd-bfe6-cade8e8e2258	50	2018-09-27 00:00:00	\N
f05d0d22-d497-4c45-91ee-e7ee4efea8e2	91e77ac7-b0dc-4bab-a169-f167b20e5cce	3d5f7fc5-c5f6-4dcd-bfe6-cade8e8e2258	50	2018-09-27 00:00:00	\N
f2332de3-5884-46c8-8b92-23bd68aee175	53655499-8ae3-4afc-b9d1-44e7b237f3bd	39a0b470-42dc-47e3-a009-3acb4ae84f28	100	2020-03-15 00:00:00	\N
dede57ba-d1df-4727-84d7-c0f060ce956e	5ee388f3-1d23-47a8-a232-295980277fdf	c9cf7e6c-c048-4be7-9feb-b07021ce9c69	100	2021-06-01 00:00:00	\N
55bd1887-0e05-4413-aa60-e2f6b448bf6a	09462c40-ff0d-4a51-88f9-0f23fabd3007	39a0b470-42dc-47e3-a009-3acb4ae84f28	50	2022-01-10 00:00:00	\N
ad8307a1-8648-41f7-9f19-c04691702829	09462c40-ff0d-4a51-88f9-0f23fabd3007	c9cf7e6c-c048-4be7-9feb-b07021ce9c69	50	2022-01-10 00:00:00	\N
3e0fc446-e7ca-4843-b2c6-db32b03dfba3	d68208db-8df2-4d80-b59c-85d43bc3c6d6	0d78d695-6a3a-47ca-adc6-591c6c7a733c	100	2019-08-20 00:00:00	\N
fa10cca7-f593-420b-ac7f-ceaae46cfa8d	e40bed96-95fe-482d-ad2f-6dd3c11e420e	57835f87-9a88-44a1-bfb8-f70b501ac5e7	100	2023-02-01 00:00:00	\N
af3618f4-aa13-4f82-ad64-207c11bb550e	71d07510-9193-4bf9-a814-e6a1498e2cf0	6aa1ff35-a949-409b-8adc-fc354e493d4f	100	2018-11-05 00:00:00	\N
4cf3d880-8cb4-4338-8727-d70953426c00	5333a2e4-1ddf-414e-becf-a9b0860bddde	b7e6e265-f34e-47e3-9204-04db6da2b083	100	2024-01-15 00:00:00	\N
97a7487f-fe9e-4f4e-931b-681bc5d3108d	909ed4e8-fb53-49f8-aecf-5b56c10e1e30	5c600f8c-c59d-49ae-bdcd-94c8ef1c4625	100	2026-03-16 00:00:00	\N
0b3db0d5-e720-4469-bd29-36ce65e7eff9	7adb3521-845b-41de-8054-3281ddfc0f3c	2fcd7d8c-13c0-4d5b-96d3-0f2ec2131c65	100	2026-03-17 13:58:43.652	\N
875bead3-2fc7-4caa-9c7e-a6afe83f5d65	f5d74705-ef3d-439d-bf89-a2c1c2a17f34	0892c9b2-1cc1-4e21-bd9b-68bd1ce2e521	100	2026-03-17 14:00:40.821	\N
\.


--
-- Data for Name: partial_payment_rules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.partial_payment_rules (id, association_id, allow_partial_payments, minimum_payment_amount, minimum_payment_percent, require_payment_confirmation, send_receipt_email, receipt_email_template, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: payment_event_transitions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payment_event_transitions (id, webhook_event_id, from_status, to_status, reason, transitioned_at, transitioned_by) FROM stdin;
\.


--
-- Data for Name: payment_gateway_connections; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payment_gateway_connections (id, association_id, provider, provider_account_id, publishable_key, secret_key_masked, webhook_secret_masked, validation_status, validation_message, is_active, last_validated_at, metadata_json, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: payment_method_configs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payment_method_configs (id, association_id, method_type, display_name, instructions, support_email, support_phone, is_active, display_order, created_at, updated_at, account_name, bank_name, routing_number, account_number, mailing_address, payment_notes, zelle_handle) FROM stdin;
769b4de2-e00d-424d-9e1b-a374cafe43f7	5d4488b7-c229-4412-8762-d822e4f150f3	ach	ACH Transfer	Use routing 011000015 and account 123456789.	billing@example.com	555-0111	1	0	2026-03-11 14:12:44.198191	2026-03-11 14:12:44.197	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: payment_plans; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payment_plans (id, association_id, unit_id, person_id, total_amount, amount_paid, installment_amount, installment_frequency, start_date, next_due_date, end_date, status, notes, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: payment_reminder_rules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payment_reminder_rules (id, association_id, name, template_id, days_relative_to_due, trigger_on, min_balance_threshold, is_active, last_run_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: payment_webhook_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payment_webhook_events (id, association_id, provider, provider_event_id, payment_link_id, unit_id, person_id, amount, currency, status, event_type, gateway_reference, raw_payload_json, processed_at, owner_ledger_entry_id, error_message, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: permission_change_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.permission_change_logs (id, user_id, old_role, new_role, changed_by, reason, created_at) FROM stdin;
cc71d62c-31f2-414f-be8e-4469e72408ba	ae7a1d67-d01a-4041-ac39-68e1519ee77d	board-admin	platform-admin	admin@local	because i said so	2026-03-16 16:04:32.803228
\.


--
-- Data for Name: permission_envelopes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.permission_envelopes (id, association_id, name, audience, permissions_json, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: persons; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.persons (id, first_name, last_name, email, phone, mailing_address, created_at, emergency_contact_name, emergency_contact_phone, contact_preference, association_id) FROM stdin;
0d0da41f-792c-4c4e-80b5-cc8cc48f643d	Maria	Gonzalez	maria.gonzalez@email.com	(305) 555-0101	1200 Ocean Drive Unit 101, Miami Beach, FL 33139	2026-03-06 16:20:53.700329	\N	\N	email	\N
88a352fb-a6c8-48b6-adc5-de3a0e48cf90	James	Chen	j.chen@email.com	(305) 555-0102	1200 Ocean Drive Unit 102, Miami Beach, FL 33139	2026-03-06 16:20:53.700329	\N	\N	email	\N
98644005-412a-4640-9911-e8f8166dd71e	Sarah	Williams	sarah.w@email.com	(312) 555-0201	450 Lakeview Blvd Unit 1A, Chicago, IL 60601	2026-03-06 16:20:53.700329	\N	\N	email	\N
9144a5a1-8e77-481c-a93f-8246841b6020	Robert	Thompson	r.thompson@email.com	(415) 555-0301	789 Bay Street PH1, San Francisco, CA 94133	2026-03-06 16:20:53.700329	\N	\N	email	\N
eb590fdb-bee3-42ce-b611-2cf3d61b4e2e	Lisa	Patel	lisa.patel@email.com	(312) 555-0202	450 Lakeview Blvd Unit 3B, Chicago, IL 60601	2026-03-06 16:20:53.700329	\N	\N	email	\N
b98d4084-1656-47a9-8d99-be65cb5a1f2f	David	Kim	d.kim@email.com	(305) 555-0103	\N	2026-03-06 16:20:53.700329	\N	\N	email	\N
d645338d-bf6e-47ac-8961-6f307fff8eb9	Jennifer	Martinez	j.martinez@email.com	(415) 555-0302	789 Bay Street Unit 501, San Francisco, CA 94133	2026-03-06 16:20:53.700329	\N	\N	email	\N
28d6ffca-94ef-4550-b5c3-226e291848be	Owner	B	owner-b-771782db@local	\N	\N	2026-03-07 18:22:59.329501	\N	\N	email	\N
6ee42f4c-367f-4846-b956-3f5c71c77ce1	Owner	A	owner-a-771782db@local	555-0101	New Address	2026-03-07 18:22:59.323021	\N	\N	email	\N
90244190-fc1e-4ee0-bc75-211976bfa542	Owner	B	owner-b-144ac799@local	\N	\N	2026-03-07 18:23:12.808658	\N	\N	email	\N
6ae0df0d-b1ad-473a-adae-3d2f03bf8833	Owner	A	owner-a-144ac799@local	555-0101	New Address	2026-03-07 18:23:12.803349	\N	\N	email	\N
33402f2c-88ad-4b6d-b0f0-6e9f70d8448e	Owner	B	owner-b-5b429e33@local	\N	\N	2026-03-07 18:38:04.695471	\N	\N	email	\N
084f023f-ba12-484d-872d-ee4c0bbaf226	Owner	A	owner-a-5b429e33@local	555-0101	New Address	2026-03-07 18:38:04.6896	\N	\N	email	\N
f6037f39-f74f-4357-aa30-a0e01453c9be	Taylor	Verifier546983	verify-546983@example.com	555-100-0000	100 Test Way	2026-03-09 15:35:47.074659	\N	\N	email	\N
c74a1999-eba0-4c9c-9b3b-dd931da43f6b	Taylor	Verifier831011	verify-831011@example.com	555-100-0000	100 Test Way	2026-03-09 15:40:31.067828	\N	\N	email	\N
305e514f-ea47-4a27-9704-72d3772f4c00	Taylor	Verifier377141	verify-377141@example.com	555-100-0000	100 Test Way	2026-03-09 15:49:37.196995	\N	\N	email	\N
172f12c5-ee42-4f89-90bc-c264c4c3c17d	1415 Quinnipiac	Ave	\N	\N	CT  06513	2026-03-09 16:04:54.666824	\N	\N	email	\N
6bc0b97d-8122-4606-b9df-c47178bd5477	A	Unknown	rnsofor@yahoo.com	203-469-1363	\N	2026-03-09 16:04:54.694844	\N	\N	email	\N
9b9f4306-666e-4fdc-921b-b4b3c6444a06	C	Unknown	joseomarsanchez77@gmail.com	203-535-4821	\N	2026-03-09 16:04:54.731893	\N	\N	email	\N
f5d419d2-ffde-4803-a921-405a0355b5ba	1417 Quinnipiac	Ave	\N	\N	CT  06513	2026-03-09 16:04:54.744166	\N	\N	email	\N
f9f69aa8-cf83-4a49-841b-9885b2c8043d	B	Unknown	gachigasim@gmail.com	203-209-3642	`	2026-03-09 16:04:54.714371	\N	\N	email	\N
0f7d7938-c9eb-4daf-a605-26913c33a080	D	Unknown	fanningcatherine@hotmail.com	203-214-1944	\N	2026-03-09 16:04:54.805944	\N	\N	email	\N
ed84f0f0-b6e6-49c2-a056-74bd9e7d450e	E	Unknown	fuquana.heyward@yahoo.com	2035898864	\N	2026-03-09 16:04:54.824257	\N	\N	email	\N
283bcf8c-2e1a-4bca-b176-bbfbed0f4ccb	F	Unknown	williamruiz11@gmail.com	203-676-4815	\N	2026-03-09 16:04:54.842118	\N	\N	email	\N
802a3702-58d9-4361-b52e-fc5f9143a577	G	Unknown	dhtorok@comcast.net	203-400-4943	\N	2026-03-09 16:04:54.858805	\N	\N	email	\N
b1df62de-9534-47a7-8423-ac3a696087c5	1419 Quinnipiac	Ave	\N	\N	CT  06513	2026-03-09 16:04:54.870275	\N	\N	email	\N
24aeb79d-5675-4955-a038-959a82b833ef	1	Family	lestertillman@hotmail.com	203-823-5557	\N	2026-03-09 16:04:54.88824	\N	\N	email	\N
a7e1aeaf-80f0-4259-ae24-166cae2e9a79	1421 Quinnipiac	Ave	\N	\N	CT  06513	2026-03-09 16:04:54.898756	\N	\N	email	\N
23a44250-f9b2-42a0-ba62-b3ef119a8f54	Quinn	Owner	qa-owner-364067@example.com	555-0100	100 Verification Way	2026-03-11 14:12:44.152056	Emergency Contact	555-0199	email	\N
6d7e25b7-d062-4a9e-af3f-a5c0d934ca70	CHC	Management	chcmgmt18@gmail.com	\N	\N	2026-03-15 14:59:57.330335	\N	\N	email	\N
fe7e6966-711d-415d-b69e-724cad0e0ea4	w	r	williamruiz11@gmail.com	2036764815	10 Legend Lane, East Haven, Connecticut, United States	2026-03-16 16:58:46.98731	\N	\N	email	\N
8a431f1b-c1c4-414f-bdc3-5d5b446cd7e3	w	r	williamruiz11@gmail.com	2036764815	714 blackshire 	2026-03-16 17:01:22.475421	\N	\N	email	\N
f49f0d4b-01fd-4ea3-b8be-2d70229eb549	William	Ruiz	williamruiz11@gmail.com	2036764815	714 Blackshire Road, Wilmington, Delaware, United States	2026-03-16 18:21:29.142839	\N	\N	email	\N
e64948e9-e5e2-4504-aae3-3023701d7602	Felipe	Pantoja	Minerva.miranda57@outlook.com	203-804-9751	1421D Quinnipiac Ave, New Haven, CT, 06513	2026-03-16 19:44:33.864324	\N	\N	email	\N
bc4206ca-98dc-4284-9493-b874420e4374	Terri	Yarbrough	terriyarbrough2415@gmail.com	203-645-1457	\N	2026-03-16 19:44:33.898847	\N	\N	email	\N
c20a508c-c0a1-42dc-8bee-4c7afd45d117	Audrey	Richards	Minerva.miranda57@outlook.com	203-645-1457	\N	2026-03-16 20:18:40.852546	\N	\N	email	\N
5dd27a32-c1ee-4826-bf18-db9df778eea3	Omar and Medea	Sanchez	joseomarsanchez77@gmail.com	2035354822	1415 Quinnipiac Ave unit c, New Haven, CT, 06513	2026-03-16 22:52:54.404892	\N	\N	email	\N
acf06065-a75c-45ab-9c55-b5fddecef158	Allison	TOROK	alleykat1616@gmail.com	203 850-4758	\N	2026-03-16 22:52:55.629364	\N	\N	email	\N
3d5f7fc5-c5f6-4dcd-bfe6-cade8e8e2258	Stephen	TOROK	dhtorok@comcast.net	2034004943	1417 Quinnipiac Ave Unit G, New Haven, Connecticut, 06513	2026-03-16 22:52:55.577955	\N	\N	email	\N
39a0b470-42dc-47e3-a009-3acb4ae84f28	Maria	Gonzalez	maria.gonzalez@email.com	(305) 555-0101	1200 Ocean Drive Unit 101, Miami Beach, FL 33139	2026-03-17 00:50:41.914813	\N	\N	email	\N
c9cf7e6c-c048-4be7-9feb-b07021ce9c69	James	Chen	j.chen@email.com	(305) 555-0102	1200 Ocean Drive Unit 102, Miami Beach, FL 33139	2026-03-17 00:50:41.914813	\N	\N	email	\N
0d78d695-6a3a-47ca-adc6-591c6c7a733c	Sarah	Williams	sarah.w@email.com	(312) 555-0201	450 Lakeview Blvd Unit 1A, Chicago, IL 60601	2026-03-17 00:50:41.914813	\N	\N	email	\N
6aa1ff35-a949-409b-8adc-fc354e493d4f	Robert	Thompson	r.thompson@email.com	(415) 555-0301	789 Bay Street PH1, San Francisco, CA 94133	2026-03-17 00:50:41.914813	\N	\N	email	\N
57835f87-9a88-44a1-bfb8-f70b501ac5e7	Lisa	Patel	lisa.patel@email.com	(312) 555-0202	450 Lakeview Blvd Unit 3B, Chicago, IL 60601	2026-03-17 00:50:41.914813	\N	\N	email	\N
38abdc09-7717-49d7-b8c8-79967435dd93	David	Kim	d.kim@email.com	(305) 555-0103	\N	2026-03-17 00:50:41.914813	\N	\N	email	\N
b7e6e265-f34e-47e3-9204-04db6da2b083	Jennifer	Martinez	j.martinez@email.com	(415) 555-0302	789 Bay Street Unit 501, San Francisco, CA 94133	2026-03-17 00:50:41.914813	\N	\N	email	\N
5c600f8c-c59d-49ae-bdcd-94c8ef1c4625	Gloria	Achigasim	Gachigasim@gmail.com	2032093642	1415b Quinnipiac Ave, New Haven, CT, 06513	2026-03-17 01:21:02.699328	\N	\N	email	\N
348cc250-9f30-47d1-81c9-8f535f479bb4	Madea	Sanchez	graphie20@gmail.com	\N	\N	2026-03-17 13:34:14.74539	\N	\N	email	\N
2fcd7d8c-13c0-4d5b-96d3-0f2ec2131c65	Nsofor	Robinson	rnsofor@yahoo.com	203-980-1193	1415 A Quinnipiac	2026-03-17 13:36:38.345428	\N	\N	email	f301d073-ed84-4d73-84ce-3ef28af66f7a
0892c9b2-1cc1-4e21-bd9b-68bd1ce2e521	Luz	Minerva	minerva.miranda57@outlook.com	2036451457	10 Legend Lane, East Haven, Connecticut, United States	2026-03-17 14:00:40.763242	\N	\N	email	f301d073-ed84-4d73-84ce-3ef28af66f7a
\.


--
-- Data for Name: portal_access; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.portal_access (id, association_id, person_id, unit_id, email, role, status, last_login_at, created_at, updated_at, board_role_id, invited_by, invited_at, accepted_at, suspended_at, revoked_at) FROM stdin;
751e20ee-c8b9-4e2d-9ec4-7b716689617a	f301d073-ed84-4d73-84ce-3ef28af66f7a	e64948e9-e5e2-4504-aae3-3023701d7602	a5b46109-1514-4207-9ed3-2b587ead617f	minerva.miranda57@outlook.com	owner	active	\N	2026-03-16 19:44:33.885447	2026-03-16 20:18:40.844	\N	\N	\N	2026-03-16 19:44:33.885	\N	\N
1fd1e704-557d-4212-81dd-940816d9f56d	f301d073-ed84-4d73-84ce-3ef28af66f7a	c20a508c-c0a1-42dc-8bee-4c7afd45d117	a5b46109-1514-4207-9ed3-2b587ead617f	minerva.miranda57@outloo.com	tenant	active	\N	2026-03-16 20:18:40.870769	2026-03-16 20:18:40.87	\N	\N	\N	2026-03-16 20:18:40.87	\N	\N
d54cbf3c-d698-409e-99b0-74104a9e67e2	f301d073-ed84-4d73-84ce-3ef28af66f7a	5dd27a32-c1ee-4826-bf18-db9df778eea3	341b2050-28cf-4d3d-bc44-ef5a0f6584d9	joseomarsanchez77@gmail.com	owner	active	\N	2026-03-16 22:52:54.471942	2026-03-16 22:52:54.471	\N	\N	\N	2026-03-16 22:52:54.471	\N	\N
2c0d5d9a-91ea-40f3-bebf-b1cc57ce2d68	f301d073-ed84-4d73-84ce-3ef28af66f7a	3d5f7fc5-c5f6-4dcd-bfe6-cade8e8e2258	91e77ac7-b0dc-4bab-a169-f167b20e5cce	dhtorok@comcast.net	owner	active	\N	2026-03-16 22:52:55.597551	2026-03-16 22:52:55.62	\N	\N	\N	2026-03-16 22:52:55.597	\N	\N
19d6ca13-1eed-4e58-89d8-d9be8af94b9b	f301d073-ed84-4d73-84ce-3ef28af66f7a	acf06065-a75c-45ab-9c55-b5fddecef158	91e77ac7-b0dc-4bab-a169-f167b20e5cce	alleykat1616@gmail.com	tenant	active	\N	2026-03-16 22:52:55.649314	2026-03-16 22:52:55.648	\N	\N	\N	2026-03-16 22:52:55.648	\N	\N
cc4bb536-0e35-414d-a436-64bb544d07da	f301d073-ed84-4d73-84ce-3ef28af66f7a	5c600f8c-c59d-49ae-bdcd-94c8ef1c4625	909ed4e8-fb53-49f8-aecf-5b56c10e1e30	gachigasim@gmail.com	owner	active	\N	2026-03-17 01:21:02.732514	2026-03-17 01:21:02.732	\N	\N	\N	2026-03-17 01:21:02.732	\N	\N
d8db40ff-9753-48e0-8383-83c0ac8fd78f	628b7d4b-b052-44a5-9bcc-69784581450c	6d7e25b7-d062-4a9e-af3f-a5c0d934ca70	\N	chcmgmt18@gmail.com	board-member	active	\N	2026-03-15 14:59:57.335241	2026-03-15 14:59:57.335241	\N	system	2026-03-15 14:59:57.334	2026-03-15 14:59:57.334	\N	\N
ec96d695-f664-4b94-bbfd-e1fa140cd576	f301d073-ed84-4d73-84ce-3ef28af66f7a	bc4206ca-98dc-4284-9493-b874420e4374	f5d74705-ef3d-439d-bf89-a2c1c2a17f34	terriyarbrough2415@gmail.com	tenant	active	\N	2026-03-16 19:44:33.92029	2026-03-16 19:44:33.919	\N	\N	\N	2026-03-16 19:44:33.919	\N	\N
\.


--
-- Data for Name: portal_login_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.portal_login_tokens (id, association_id, email, otp_hash, expires_at, used_at, attempts, created_at) FROM stdin;
\.


--
-- Data for Name: reconciliation_periods; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reconciliation_periods (id, association_id, period_label, start_date, end_date, status, import_id, closed_by, closed_at, locked_by, locked_at, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: recurring_charge_runs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recurring_charge_runs (id, schedule_id, association_id, unit_id, amount, status, ledger_entry_id, error_message, retry_count, next_retry_at, ran_at, created_at) FROM stdin;
\.


--
-- Data for Name: recurring_charge_schedules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recurring_charge_schedules (id, association_id, unit_id, charge_description, entry_type, amount, frequency, day_of_month, next_run_date, status, max_retries, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: resident_feedbacks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.resident_feedbacks (id, association_id, unit_id, person_id, category, satisfaction_score, subject, feedback_text, is_anonymous, admin_notes, status, resolved_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: resolutions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.resolutions (id, association_id, meeting_id, title, description, status, passed_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: saved_payment_methods; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.saved_payment_methods (id, association_id, person_id, method_type, display_name, last4, bank_name, external_token_ref, is_default, is_active, added_at, updated_at) FROM stdin;
\.


--
-- Data for Name: special_assessments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.special_assessments (id, association_id, name, total_amount, start_date, end_date, installment_count, notes, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: suggested_links; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.suggested_links (id, clause_record_id, entity_type, entity_id, confidence_score, is_approved, created_at, updated_at) FROM stdin;
e017809c-e307-4717-9109-f6d013555380	95236d59-99f9-4971-a8c3-a1d8b64620dd	governance-template-item	budget-review	0.7	0	2026-03-07 18:12:38.046592	2026-03-07 18:12:38.046
59f7ac64-bb43-4b59-827b-1bfceea3f4de	5adfd1b8-a066-4a3a-a044-7e789b18e589	governance-template-item	budget-review	0.7	1	2026-03-07 18:12:38.062037	2026-03-07 18:12:38.074
bc5f4438-0cc2-4edd-93f8-0afc5e015583	a6196f56-1361-4ebd-845f-7717ecd7a6d1	governance-template-item	budget-review	0.7	0	2026-03-07 18:37:53.756126	2026-03-07 18:37:53.755
b68b10d0-4e1d-4e69-ba69-d6cf51187c81	e04d43fb-58b3-4103-a910-24c152ee40d2	governance-template-item	budget-review	0.7	1	2026-03-07 18:37:53.772547	2026-03-07 18:37:53.784
36498c1d-61a1-4264-b2c5-808ef09056df	b0467640-da3a-480e-831b-e19507f5c663	governance-template-item	budget-review	0.7	0	2026-03-09 15:39:07.442496	2026-03-09 15:39:07.442
e387fe7f-e4a9-45a0-87c1-a30aba151269	e30d9d81-c1b3-4aff-b95b-6fe403908277	governance-template-item	budget-review	0.7	0	2026-03-09 15:39:33.305398	2026-03-09 15:39:33.305
f0c0408a-ec76-4f3c-bccd-c0d22a059a66	36408554-891f-401b-9c06-8cb5e8d62c41	governance-template-item	budget-review	0.7	0	2026-03-09 15:40:31.280301	2026-03-09 15:40:31.279
7a0d1f70-96fb-4559-83a8-ccd4296cd410	06ad66ca-05a6-4156-98a3-fe559da8d7c5	governance-template-item	budget-review	0.7	0	2026-03-09 15:49:37.232791	2026-03-09 15:49:37.232
7301d5d7-c5d5-43fc-b491-928d1a8be6fe	8d016d51-526e-4d5e-af78-39c3094a3479	governance-template-item	budget-review	0.7	0	2026-03-09 19:45:31.337749	2026-03-09 19:45:31.337
1fb64579-3b94-461b-9b24-079faabfb84f	6f0dc254-4b8c-48ea-a211-8b8118c8cc7e	governance-template-item	budget-review	0.7	0	2026-03-09 19:46:43.323346	2026-03-09 19:46:43.322
\.


--
-- Data for Name: tenant_configs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tenant_configs (id, association_id, portal_name, support_email, allow_contact_updates, owner_document_visibility, gmail_integration_status, default_notice_footer, created_at, updated_at, ai_ingestion_rollout_mode, ai_ingestion_canary_percent, ai_ingestion_rollout_notes, management_type, management_company_name) FROM stdin;
\.


--
-- Data for Name: unit_change_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.unit_change_history (id, unit_id, field_name, old_value, new_value, changed_by, changed_at) FROM stdin;
431731ba-3adc-4ac2-b045-247d0b99598d	96696dfe-9feb-439a-ba29-88b79c5a74fd	unitNumber	1421	B	admin@local	2026-03-12 16:04:56.43635
a399660c-99d0-4f9c-8a71-66796a70993f	96696dfe-9feb-439a-ba29-88b79c5a74fd	building	B	1421	admin@local	2026-03-12 16:04:56.441866
d6e4a21c-81ff-4528-97bf-ba8a37be9ccb	4bceb699-2677-4289-8ce5-81f2af60597b	buildingId	\N	cb058638-da68-4b2b-b961-7bed993cc5e6	verify-building-first-092492@local	2026-03-12 16:31:32.57134
b8b66923-dd40-4e57-86b0-215607f31ca0	4bceb699-2677-4289-8ce5-81f2af60597b	building	Legacy Tower	Building-A-092492	verify-building-first-092492@local	2026-03-12 16:31:32.574641
\.


--
-- Data for Name: units; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.units (id, association_id, unit_number, building, square_footage, created_at, building_id) FROM stdin;
355b724f-3596-4565-8dfd-a5c9f4b5a9fb	5d4488b7-c229-4412-8762-d822e4f150f3	QA-364067	A	900	2026-03-11 14:12:44.141847	\N
c3d299b7-60a1-4012-843b-69d70c1c1d10	f61e4b10-01a3-4670-87b3-c2a7749b2958	A-092492	Building-A-092492	950	2026-03-12 16:31:32.549013	cb058638-da68-4b2b-b961-7bed993cc5e6
4bceb699-2677-4289-8ce5-81f2af60597b	f61e4b10-01a3-4670-87b3-c2a7749b2958	LEG-092492	Building-A-092492	880	2026-03-12 16:31:32.558063	cb058638-da68-4b2b-b961-7bed993cc5e6
34575428-ea77-4013-bd0f-593e0c7dbbbb	f301d073-ed84-4d73-84ce-3ef28af66f7a	A	1417	\N	2026-03-12 20:16:43.272672	f249583c-5d75-4865-a6ca-d01f0b4dd3a6
b1f60b15-3cec-4cca-8c1c-0a0ba7bf4d7f	f301d073-ed84-4d73-84ce-3ef28af66f7a	B	1417	\N	2026-03-12 20:17:14.746188	f249583c-5d75-4865-a6ca-d01f0b4dd3a6
96696dfe-9feb-439a-ba29-88b79c5a74fd	f301d073-ed84-4d73-84ce-3ef28af66f7a	B	1421	1200	2026-03-12 16:04:46.869181	e4f64f48-6136-457c-af87-20223cfc81ef
bfa54c14-9fcd-4ed4-a810-61f193aa7d4b	f301d073-ed84-4d73-84ce-3ef28af66f7a	A	1421	1500	2026-03-12 16:05:19.336791	e4f64f48-6136-457c-af87-20223cfc81ef
16795e0e-2a66-4a5a-9977-0d93e7790c6e	f301d073-ed84-4d73-84ce-3ef28af66f7a	C	1421	1200	2026-03-12 16:05:29.241907	e4f64f48-6136-457c-af87-20223cfc81ef
f5d74705-ef3d-439d-bf89-a2c1c2a17f34	f301d073-ed84-4d73-84ce-3ef28af66f7a	D	1421	\N	2026-03-12 16:05:38.971217	e4f64f48-6136-457c-af87-20223cfc81ef
a5b46109-1514-4207-9ed3-2b587ead617f	f301d073-ed84-4d73-84ce-3ef28af66f7a	C	1417	\N	2026-03-14 14:32:33.169891	f249583c-5d75-4865-a6ca-d01f0b4dd3a6
978bacef-824f-471e-80ea-891a8eaa01f8	f301d073-ed84-4d73-84ce-3ef28af66f7a	D	1417	\N	2026-03-14 14:32:41.054866	f249583c-5d75-4865-a6ca-d01f0b4dd3a6
3b5e2a2f-81cc-4199-9333-858c8f0fca9c	f301d073-ed84-4d73-84ce-3ef28af66f7a	E	1417	\N	2026-03-14 14:32:45.472793	f249583c-5d75-4865-a6ca-d01f0b4dd3a6
8b029a2d-c7e4-4cb1-ad82-9f9829877208	f301d073-ed84-4d73-84ce-3ef28af66f7a	F	1417	\N	2026-03-14 14:32:48.539604	f249583c-5d75-4865-a6ca-d01f0b4dd3a6
91e77ac7-b0dc-4bab-a169-f167b20e5cce	f301d073-ed84-4d73-84ce-3ef28af66f7a	G	1417	\N	2026-03-14 14:32:51.224149	f249583c-5d75-4865-a6ca-d01f0b4dd3a6
968ed680-252a-4be9-ae77-9312e8a5a150	f301d073-ed84-4d73-84ce-3ef28af66f7a	F	1421	\N	2026-03-14 14:33:02.805921	e4f64f48-6136-457c-af87-20223cfc81ef
a1a7aef1-3b07-414c-ae6a-3093cf5105cd	f301d073-ed84-4d73-84ce-3ef28af66f7a	G	1421	\N	2026-03-14 14:33:05.929657	e4f64f48-6136-457c-af87-20223cfc81ef
909ed4e8-fb53-49f8-aecf-5b56c10e1e30	f301d073-ed84-4d73-84ce-3ef28af66f7a	B	1415	\N	2026-03-14 14:37:36.209876	b11ea5a8-d907-4063-a0ed-640874159f61
341b2050-28cf-4d3d-bc44-ef5a0f6584d9	f301d073-ed84-4d73-84ce-3ef28af66f7a	C	1415	\N	2026-03-14 14:37:40.80897	b11ea5a8-d907-4063-a0ed-640874159f61
a882cbbb-1061-4764-8b2b-d9398e2ccedb	f301d073-ed84-4d73-84ce-3ef28af66f7a	1419	1419	\N	2026-03-14 14:38:22.286475	8a0fafb2-cc66-400f-a3dc-74617e39eefc
3d308aff-6712-4628-b812-e247c38ab92b	f301d073-ed84-4d73-84ce-3ef28af66f7a	E	1421	\N	2026-03-14 14:32:59.195813	e4f64f48-6136-457c-af87-20223cfc81ef
53655499-8ae3-4afc-b9d1-44e7b237f3bd	7a1f216a-8ac9-4fe9-a8d2-b62b01565a42	101	A	1250	2026-03-17 00:50:41.786334	\N
5ee388f3-1d23-47a8-a232-295980277fdf	7a1f216a-8ac9-4fe9-a8d2-b62b01565a42	102	A	980	2026-03-17 00:50:41.786334	\N
09462c40-ff0d-4a51-88f9-0f23fabd3007	7a1f216a-8ac9-4fe9-a8d2-b62b01565a42	201	B	1400	2026-03-17 00:50:41.786334	\N
3b4e6ce7-9168-44ff-8913-c086695e12f7	7a1f216a-8ac9-4fe9-a8d2-b62b01565a42	301	B	1600	2026-03-17 00:50:41.786334	\N
d68208db-8df2-4d80-b59c-85d43bc3c6d6	f627dc9b-cde0-44c0-a23a-405487cb0add	1A	Main	1100	2026-03-17 00:50:41.786334	\N
baae6fdb-9b08-424c-92f8-69dbe12b599e	f627dc9b-cde0-44c0-a23a-405487cb0add	2A	Main	1100	2026-03-17 00:50:41.786334	\N
e40bed96-95fe-482d-ad2f-6dd3c11e420e	f627dc9b-cde0-44c0-a23a-405487cb0add	3B	East	1350	2026-03-17 00:50:41.786334	\N
71d07510-9193-4bf9-a814-e6a1498e2cf0	e60c349e-b14e-48fa-a72e-8af3c2180c74	PH1	\N	2200	2026-03-17 00:50:41.786334	\N
5333a2e4-1ddf-414e-becf-a9b0860bddde	e60c349e-b14e-48fa-a72e-8af3c2180c74	501	\N	1050	2026-03-17 00:50:41.786334	\N
7adb3521-845b-41de-8054-3281ddfc0f3c	f301d073-ed84-4d73-84ce-3ef28af66f7a	A	1415	\N	2026-03-14 14:37:34.228833	b11ea5a8-d907-4063-a0ed-640874159f61
\.


--
-- Data for Name: user_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_sessions (sid, sess, expire) FROM stdin;
T1LsggJJ6FuAKllaZ1zTMDESuDnz1tAz	{"cookie": {"path": "/", "secure": false, "expires": "2026-03-19T19:33:37.373Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "oauthPopup": false, "oauthReturnTo": "/"}	2026-03-19 19:33:38
rJao9CPFBuDucBsobk2UtoePyjJZQ0PL	{"cookie": {"path": "/", "secure": false, "expires": "2026-03-19T21:26:11.374Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "oauthPopup": false, "oauthReturnTo": "/", "oauthCallbackUrl": "http://127.0.0.1:5001/api/auth/google/callback"}	2026-03-19 21:26:12
CuNEVISPWhmSxklFn6XW3e3COcS-KuXa	{"cookie": {"path": "/", "secure": false, "expires": "2026-03-19T19:34:30.962Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "oauthPopup": false, "oauthReturnTo": "/"}	2026-03-19 19:34:31
fIiM5v30CpMV0cK1b4h2ylBIWDWP8RkB	{"cookie": {"path": "/", "secure": false, "expires": "2026-03-19T20:13:09.514Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "oauthPopup": false, "oauthReturnTo": "/", "oauthCallbackUrl": "http://127.0.0.1:5001/api/auth/google/callback"}	2026-03-19 20:13:10
Nu5m8QgRwxmCD3rfwI0FWzSHpg7wMHag	{"cookie": {"path": "/", "secure": false, "expires": "2026-03-19T20:13:18.852Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "oauthPopup": false, "oauthReturnTo": "/"}	2026-03-19 20:13:19
6leYh0IdG0i639Vyl7Wb-Q-CKgMnIgT_	{"cookie": {"path": "/", "secure": false, "expires": "2026-03-23T22:49:17.802Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": "f255a7d2-fd0c-4e35-85f6-3cedd715e4b9"}}	2026-03-24 16:18:49
\.


--
-- Data for Name: utility_payments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.utility_payments (id, association_id, utility_type, provider_name, service_period_start, service_period_end, due_date, paid_date, amount, status, account_id, category_id, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: vendor_invoices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vendor_invoices (id, association_id, vendor_name, invoice_number, invoice_date, due_date, amount, status, account_id, category_id, notes, created_at, updated_at, vendor_id) FROM stdin;
\.


--
-- Data for Name: vendors; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vendors (id, association_id, name, trade, service_area, primary_contact_name, primary_email, primary_phone, license_number, insurance_expires_at, status, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: vote_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vote_records (id, resolution_id, voter_person_id, vote_choice, vote_weight, created_at) FROM stdin;
edada0a0-bb05-4de8-8c7a-f44b46e0b670	4aba28b5-9419-449a-ba88-75eff327abc2	\N	yes	1	2026-03-07 18:04:58.083563
29387d8d-556a-4928-9b00-3badc75a450a	4aba28b5-9419-449a-ba88-75eff327abc2	\N	no	0.25	2026-03-07 18:04:58.092734
9f1c4333-8043-4467-9d7e-41fc33f8d8ad	053c2a47-52b4-412a-9a74-55df088015e5	\N	yes	1	2026-03-07 18:37:42.852086
62f4eaae-7599-457a-a642-ffe2498bed6b	053c2a47-52b4-412a-9a74-55df088015e5	\N	no	0.25	2026-03-07 18:37:42.863242
\.


--
-- Data for Name: webhook_signing_secrets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.webhook_signing_secrets (id, association_id, secret_hash, secret_hint, provider, is_active, rotated_at, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: work_orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.work_orders (id, association_id, maintenance_request_id, unit_id, vendor_id, vendor_invoice_id, title, description, location_text, category, priority, status, assigned_to, estimated_cost, actual_cost, scheduled_for, started_at, completed_at, resolution_notes, created_at, updated_at, photos_json) FROM stdin;
\.


--
-- Name: admin_analysis_runs admin_analysis_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_analysis_runs
    ADD CONSTRAINT admin_analysis_runs_pkey PRIMARY KEY (id);


--
-- Name: admin_analysis_versions admin_analysis_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_analysis_versions
    ADD CONSTRAINT admin_analysis_versions_pkey PRIMARY KEY (id);


--
-- Name: admin_association_scopes admin_association_scopes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_association_scopes
    ADD CONSTRAINT admin_association_scopes_pkey PRIMARY KEY (id);


--
-- Name: admin_executive_evidence admin_executive_evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_executive_evidence
    ADD CONSTRAINT admin_executive_evidence_pkey PRIMARY KEY (id);


--
-- Name: admin_executive_updates admin_executive_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_executive_updates
    ADD CONSTRAINT admin_executive_updates_pkey PRIMARY KEY (id);


--
-- Name: admin_roadmap_projects admin_roadmap_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_roadmap_projects
    ADD CONSTRAINT admin_roadmap_projects_pkey PRIMARY KEY (id);


--
-- Name: admin_roadmap_tasks admin_roadmap_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_roadmap_tasks
    ADD CONSTRAINT admin_roadmap_tasks_pkey PRIMARY KEY (id);


--
-- Name: admin_roadmap_workstreams admin_roadmap_workstreams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_roadmap_workstreams
    ADD CONSTRAINT admin_roadmap_workstreams_pkey PRIMARY KEY (id);


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);


--
-- Name: ai_extracted_records ai_extracted_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_extracted_records
    ADD CONSTRAINT ai_extracted_records_pkey PRIMARY KEY (id);


--
-- Name: ai_ingestion_import_runs ai_ingestion_import_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_ingestion_import_runs
    ADD CONSTRAINT ai_ingestion_import_runs_pkey PRIMARY KEY (id);


--
-- Name: ai_ingestion_jobs ai_ingestion_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_ingestion_jobs
    ADD CONSTRAINT ai_ingestion_jobs_pkey PRIMARY KEY (id);


--
-- Name: annual_governance_tasks annual_governance_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.annual_governance_tasks
    ADD CONSTRAINT annual_governance_tasks_pkey PRIMARY KEY (id);


--
-- Name: association_assets association_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.association_assets
    ADD CONSTRAINT association_assets_pkey PRIMARY KEY (id);


--
-- Name: association_feature_flags association_feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.association_feature_flags
    ADD CONSTRAINT association_feature_flags_pkey PRIMARY KEY (id);


--
-- Name: association_insurance_policies association_insurance_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.association_insurance_policies
    ADD CONSTRAINT association_insurance_policies_pkey PRIMARY KEY (id);


--
-- Name: association_memberships association_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.association_memberships
    ADD CONSTRAINT association_memberships_pkey PRIMARY KEY (id);


--
-- Name: associations associations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.associations
    ADD CONSTRAINT associations_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: auth_external_accounts auth_external_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_external_accounts
    ADD CONSTRAINT auth_external_accounts_pkey PRIMARY KEY (id);


--
-- Name: auth_users auth_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_users
    ADD CONSTRAINT auth_users_pkey PRIMARY KEY (id);


--
-- Name: autopay_enrollments autopay_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autopay_enrollments
    ADD CONSTRAINT autopay_enrollments_pkey PRIMARY KEY (id);


--
-- Name: autopay_runs autopay_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autopay_runs
    ADD CONSTRAINT autopay_runs_pkey PRIMARY KEY (id);


--
-- Name: bank_statement_imports bank_statement_imports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_statement_imports
    ADD CONSTRAINT bank_statement_imports_pkey PRIMARY KEY (id);


--
-- Name: bank_statement_transactions bank_statement_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_statement_transactions
    ADD CONSTRAINT bank_statement_transactions_pkey PRIMARY KEY (id);


--
-- Name: board_package_templates board_package_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_package_templates
    ADD CONSTRAINT board_package_templates_pkey PRIMARY KEY (id);


--
-- Name: board_packages board_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_packages
    ADD CONSTRAINT board_packages_pkey PRIMARY KEY (id);


--
-- Name: board_roles board_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_roles
    ADD CONSTRAINT board_roles_pkey PRIMARY KEY (id);


--
-- Name: budget_lines budget_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_lines
    ADD CONSTRAINT budget_lines_pkey PRIMARY KEY (id);


--
-- Name: budget_versions budget_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_versions
    ADD CONSTRAINT budget_versions_pkey PRIMARY KEY (id);


--
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);


--
-- Name: buildings buildings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buildings
    ADD CONSTRAINT buildings_pkey PRIMARY KEY (id);


--
-- Name: calendar_events calendar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);


--
-- Name: clause_records clause_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clause_records
    ADD CONSTRAINT clause_records_pkey PRIMARY KEY (id);


--
-- Name: clause_tags clause_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clause_tags
    ADD CONSTRAINT clause_tags_pkey PRIMARY KEY (id);


--
-- Name: collections_handoffs collections_handoffs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections_handoffs
    ADD CONSTRAINT collections_handoffs_pkey PRIMARY KEY (id);


--
-- Name: communication_history communication_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_history
    ADD CONSTRAINT communication_history_pkey PRIMARY KEY (id);


--
-- Name: community_announcements community_announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_announcements
    ADD CONSTRAINT community_announcements_pkey PRIMARY KEY (id);


--
-- Name: compliance_alert_overrides compliance_alert_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_alert_overrides
    ADD CONSTRAINT compliance_alert_overrides_pkey PRIMARY KEY (id);


--
-- Name: contact_update_requests contact_update_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_update_requests
    ADD CONSTRAINT contact_update_requests_pkey PRIMARY KEY (id);


--
-- Name: delinquency_escalations delinquency_escalations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delinquency_escalations
    ADD CONSTRAINT delinquency_escalations_pkey PRIMARY KEY (id);


--
-- Name: delinquency_thresholds delinquency_thresholds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delinquency_thresholds
    ADD CONSTRAINT delinquency_thresholds_pkey PRIMARY KEY (id);


--
-- Name: document_tags document_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tags
    ADD CONSTRAINT document_tags_pkey PRIMARY KEY (id);


--
-- Name: document_versions document_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: email_events email_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_events
    ADD CONSTRAINT email_events_pkey PRIMARY KEY (id);


--
-- Name: email_logs email_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_pkey PRIMARY KEY (id);


--
-- Name: email_threads email_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_threads
    ADD CONSTRAINT email_threads_pkey PRIMARY KEY (id);


--
-- Name: expense_attachments expense_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_attachments
    ADD CONSTRAINT expense_attachments_pkey PRIMARY KEY (id);


--
-- Name: feature_flags feature_flags_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_key_unique UNIQUE (key);


--
-- Name: feature_flags feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_pkey PRIMARY KEY (id);


--
-- Name: financial_accounts financial_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_accounts
    ADD CONSTRAINT financial_accounts_pkey PRIMARY KEY (id);


--
-- Name: financial_alerts financial_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_alerts
    ADD CONSTRAINT financial_alerts_pkey PRIMARY KEY (id);


--
-- Name: financial_approvals financial_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_approvals
    ADD CONSTRAINT financial_approvals_pkey PRIMARY KEY (id);


--
-- Name: financial_categories financial_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_categories
    ADD CONSTRAINT financial_categories_pkey PRIMARY KEY (id);


--
-- Name: governance_compliance_templates governance_compliance_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.governance_compliance_templates
    ADD CONSTRAINT governance_compliance_templates_pkey PRIMARY KEY (id);


--
-- Name: governance_meetings governance_meetings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.governance_meetings
    ADD CONSTRAINT governance_meetings_pkey PRIMARY KEY (id);


--
-- Name: governance_reminder_rules governance_reminder_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.governance_reminder_rules
    ADD CONSTRAINT governance_reminder_rules_pkey PRIMARY KEY (id);


--
-- Name: governance_template_items governance_template_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.governance_template_items
    ADD CONSTRAINT governance_template_items_pkey PRIMARY KEY (id);


--
-- Name: hoa_fee_schedules hoa_fee_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hoa_fee_schedules
    ADD CONSTRAINT hoa_fee_schedules_pkey PRIMARY KEY (id);


--
-- Name: inspection_records inspection_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_records
    ADD CONSTRAINT inspection_records_pkey PRIMARY KEY (id);


--
-- Name: late_fee_events late_fee_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.late_fee_events
    ADD CONSTRAINT late_fee_events_pkey PRIMARY KEY (id);


--
-- Name: late_fee_rules late_fee_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.late_fee_rules
    ADD CONSTRAINT late_fee_rules_pkey PRIMARY KEY (id);


--
-- Name: maintenance_requests maintenance_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_pkey PRIMARY KEY (id);


--
-- Name: maintenance_schedule_instances maintenance_schedule_instances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_schedule_instances
    ADD CONSTRAINT maintenance_schedule_instances_pkey PRIMARY KEY (id);


--
-- Name: maintenance_schedule_templates maintenance_schedule_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_schedule_templates
    ADD CONSTRAINT maintenance_schedule_templates_pkey PRIMARY KEY (id);


--
-- Name: meeting_agenda_items meeting_agenda_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_agenda_items
    ADD CONSTRAINT meeting_agenda_items_pkey PRIMARY KEY (id);


--
-- Name: meeting_notes meeting_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_notes
    ADD CONSTRAINT meeting_notes_pkey PRIMARY KEY (id);


--
-- Name: notice_sends notice_sends_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notice_sends
    ADD CONSTRAINT notice_sends_pkey PRIMARY KEY (id);


--
-- Name: notice_templates notice_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notice_templates
    ADD CONSTRAINT notice_templates_pkey PRIMARY KEY (id);


--
-- Name: occupancies occupancies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occupancies
    ADD CONSTRAINT occupancies_pkey PRIMARY KEY (id);


--
-- Name: onboarding_invites onboarding_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_invites
    ADD CONSTRAINT onboarding_invites_pkey PRIMARY KEY (id);


--
-- Name: onboarding_submissions onboarding_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_submissions
    ADD CONSTRAINT onboarding_submissions_pkey PRIMARY KEY (id);


--
-- Name: owner_ledger_entries owner_ledger_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_ledger_entries
    ADD CONSTRAINT owner_ledger_entries_pkey PRIMARY KEY (id);


--
-- Name: owner_payment_links owner_payment_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_payment_links
    ADD CONSTRAINT owner_payment_links_pkey PRIMARY KEY (id);


--
-- Name: ownerships ownerships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ownerships
    ADD CONSTRAINT ownerships_pkey PRIMARY KEY (id);


--
-- Name: partial_payment_rules partial_payment_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partial_payment_rules
    ADD CONSTRAINT partial_payment_rules_pkey PRIMARY KEY (id);


--
-- Name: payment_event_transitions payment_event_transitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_event_transitions
    ADD CONSTRAINT payment_event_transitions_pkey PRIMARY KEY (id);


--
-- Name: payment_gateway_connections payment_gateway_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_gateway_connections
    ADD CONSTRAINT payment_gateway_connections_pkey PRIMARY KEY (id);


--
-- Name: payment_method_configs payment_method_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_method_configs
    ADD CONSTRAINT payment_method_configs_pkey PRIMARY KEY (id);


--
-- Name: payment_plans payment_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_plans
    ADD CONSTRAINT payment_plans_pkey PRIMARY KEY (id);


--
-- Name: payment_reminder_rules payment_reminder_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_reminder_rules
    ADD CONSTRAINT payment_reminder_rules_pkey PRIMARY KEY (id);


--
-- Name: payment_webhook_events payment_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_webhook_events
    ADD CONSTRAINT payment_webhook_events_pkey PRIMARY KEY (id);


--
-- Name: permission_change_logs permission_change_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_change_logs
    ADD CONSTRAINT permission_change_logs_pkey PRIMARY KEY (id);


--
-- Name: permission_envelopes permission_envelopes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_envelopes
    ADD CONSTRAINT permission_envelopes_pkey PRIMARY KEY (id);


--
-- Name: persons persons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_pkey PRIMARY KEY (id);


--
-- Name: portal_access portal_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_access
    ADD CONSTRAINT portal_access_pkey PRIMARY KEY (id);


--
-- Name: portal_login_tokens portal_login_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_login_tokens
    ADD CONSTRAINT portal_login_tokens_pkey PRIMARY KEY (id);


--
-- Name: reconciliation_periods reconciliation_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_periods
    ADD CONSTRAINT reconciliation_periods_pkey PRIMARY KEY (id);


--
-- Name: recurring_charge_runs recurring_charge_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_charge_runs
    ADD CONSTRAINT recurring_charge_runs_pkey PRIMARY KEY (id);


--
-- Name: recurring_charge_schedules recurring_charge_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_charge_schedules
    ADD CONSTRAINT recurring_charge_schedules_pkey PRIMARY KEY (id);


--
-- Name: resident_feedbacks resident_feedbacks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resident_feedbacks
    ADD CONSTRAINT resident_feedbacks_pkey PRIMARY KEY (id);


--
-- Name: resolutions resolutions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resolutions
    ADD CONSTRAINT resolutions_pkey PRIMARY KEY (id);


--
-- Name: saved_payment_methods saved_payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_payment_methods
    ADD CONSTRAINT saved_payment_methods_pkey PRIMARY KEY (id);


--
-- Name: user_sessions session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: special_assessments special_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.special_assessments
    ADD CONSTRAINT special_assessments_pkey PRIMARY KEY (id);


--
-- Name: suggested_links suggested_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggested_links
    ADD CONSTRAINT suggested_links_pkey PRIMARY KEY (id);


--
-- Name: tenant_configs tenant_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_configs
    ADD CONSTRAINT tenant_configs_pkey PRIMARY KEY (id);


--
-- Name: unit_change_history unit_change_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_change_history
    ADD CONSTRAINT unit_change_history_pkey PRIMARY KEY (id);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: utility_payments utility_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utility_payments
    ADD CONSTRAINT utility_payments_pkey PRIMARY KEY (id);


--
-- Name: vendor_invoices vendor_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_invoices
    ADD CONSTRAINT vendor_invoices_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: vote_records vote_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vote_records
    ADD CONSTRAINT vote_records_pkey PRIMARY KEY (id);


--
-- Name: webhook_signing_secrets webhook_signing_secrets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_signing_secrets
    ADD CONSTRAINT webhook_signing_secrets_pkey PRIMARY KEY (id);


--
-- Name: work_orders work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_pkey PRIMARY KEY (id);


--
-- Name: admin_association_scopes_unique_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX admin_association_scopes_unique_uq ON public.admin_association_scopes USING btree (admin_user_id, association_id);


--
-- Name: admin_executive_updates_source_key_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX admin_executive_updates_source_key_uq ON public.admin_executive_updates USING btree (source_key);


--
-- Name: admin_users_email_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX admin_users_email_uq ON public.admin_users USING btree (email);


--
-- Name: association_feature_flags_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX association_feature_flags_uq ON public.association_feature_flags USING btree (flag_id, association_id);


--
-- Name: auth_external_accounts_provider_account_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX auth_external_accounts_provider_account_uq ON public.auth_external_accounts USING btree (provider, provider_account_id);


--
-- Name: auth_users_email_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX auth_users_email_uq ON public.auth_users USING btree (email);


--
-- Name: budget_versions_budget_version_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX budget_versions_budget_version_uq ON public.budget_versions USING btree (budget_id, version_number);


--
-- Name: buildings_association_name_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX buildings_association_name_uq ON public.buildings USING btree (association_id, name);


--
-- Name: document_tags_unique_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX document_tags_unique_uq ON public.document_tags USING btree (document_id, entity_type, entity_id);


--
-- Name: document_versions_document_version_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX document_versions_document_version_uq ON public.document_versions USING btree (document_id, version_number);


--
-- Name: onboarding_invites_token_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX onboarding_invites_token_uq ON public.onboarding_invites USING btree (token);


--
-- Name: owner_payment_links_token_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX owner_payment_links_token_uq ON public.owner_payment_links USING btree (token);


--
-- Name: partial_payment_rules_assoc_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX partial_payment_rules_assoc_uq ON public.partial_payment_rules USING btree (association_id);


--
-- Name: payment_gateway_connections_assoc_provider_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payment_gateway_connections_assoc_provider_uq ON public.payment_gateway_connections USING btree (association_id, provider);


--
-- Name: payment_webhook_events_assoc_provider_event_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payment_webhook_events_assoc_provider_event_uq ON public.payment_webhook_events USING btree (association_id, provider, provider_event_id);


--
-- Name: portal_access_assoc_email_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX portal_access_assoc_email_uq ON public.portal_access USING btree (association_id, email);


--
-- Name: suggested_links_unique_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX suggested_links_unique_uq ON public.suggested_links USING btree (clause_record_id, entity_type, entity_id);


--
-- Name: tenant_configs_association_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tenant_configs_association_uq ON public.tenant_configs USING btree (association_id);


--
-- Name: units_association_building_unit_number_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX units_association_building_unit_number_uq ON public.units USING btree (association_id, building_id, unit_number);


--
-- Name: vendors_association_name_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX vendors_association_name_uq ON public.vendors USING btree (association_id, name);


--
-- Name: webhook_signing_secrets_assoc_provider_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX webhook_signing_secrets_assoc_provider_uq ON public.webhook_signing_secrets USING btree (association_id, provider);


--
-- Name: work_orders_request_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX work_orders_request_uq ON public.work_orders USING btree (maintenance_request_id);


--
-- Name: admin_association_scopes admin_association_scopes_admin_user_id_admin_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_association_scopes
    ADD CONSTRAINT admin_association_scopes_admin_user_id_admin_users_id_fk FOREIGN KEY (admin_user_id) REFERENCES public.admin_users(id);


--
-- Name: admin_association_scopes admin_association_scopes_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_association_scopes
    ADD CONSTRAINT admin_association_scopes_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: admin_executive_evidence admin_executive_evidence_executive_update_id_admin_executive_up; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_executive_evidence
    ADD CONSTRAINT admin_executive_evidence_executive_update_id_admin_executive_up FOREIGN KEY (executive_update_id) REFERENCES public.admin_executive_updates(id);


--
-- Name: admin_executive_updates admin_executive_updates_project_id_admin_roadmap_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_executive_updates
    ADD CONSTRAINT admin_executive_updates_project_id_admin_roadmap_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.admin_roadmap_projects(id);


--
-- Name: admin_executive_updates admin_executive_updates_task_id_admin_roadmap_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_executive_updates
    ADD CONSTRAINT admin_executive_updates_task_id_admin_roadmap_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.admin_roadmap_tasks(id);


--
-- Name: admin_executive_updates admin_executive_updates_workstream_id_admin_roadmap_workstreams; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_executive_updates
    ADD CONSTRAINT admin_executive_updates_workstream_id_admin_roadmap_workstreams FOREIGN KEY (workstream_id) REFERENCES public.admin_roadmap_workstreams(id);


--
-- Name: admin_roadmap_tasks admin_roadmap_tasks_project_id_admin_roadmap_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_roadmap_tasks
    ADD CONSTRAINT admin_roadmap_tasks_project_id_admin_roadmap_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.admin_roadmap_projects(id);


--
-- Name: admin_roadmap_tasks admin_roadmap_tasks_workstream_id_admin_roadmap_workstreams_id_; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_roadmap_tasks
    ADD CONSTRAINT admin_roadmap_tasks_workstream_id_admin_roadmap_workstreams_id_ FOREIGN KEY (workstream_id) REFERENCES public.admin_roadmap_workstreams(id);


--
-- Name: admin_roadmap_workstreams admin_roadmap_workstreams_project_id_admin_roadmap_projects_id_; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_roadmap_workstreams
    ADD CONSTRAINT admin_roadmap_workstreams_project_id_admin_roadmap_projects_id_ FOREIGN KEY (project_id) REFERENCES public.admin_roadmap_projects(id);


--
-- Name: ai_extracted_records ai_extracted_records_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_extracted_records
    ADD CONSTRAINT ai_extracted_records_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: ai_extracted_records ai_extracted_records_job_id_ai_ingestion_jobs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_extracted_records
    ADD CONSTRAINT ai_extracted_records_job_id_ai_ingestion_jobs_id_fk FOREIGN KEY (job_id) REFERENCES public.ai_ingestion_jobs(id);


--
-- Name: ai_ingestion_import_runs ai_ingestion_import_runs_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_ingestion_import_runs
    ADD CONSTRAINT ai_ingestion_import_runs_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: ai_ingestion_import_runs ai_ingestion_import_runs_extracted_record_id_ai_extracted_recor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_ingestion_import_runs
    ADD CONSTRAINT ai_ingestion_import_runs_extracted_record_id_ai_extracted_recor FOREIGN KEY (extracted_record_id) REFERENCES public.ai_extracted_records(id);


--
-- Name: ai_ingestion_import_runs ai_ingestion_import_runs_ingestion_job_id_ai_ingestion_jobs_id_; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_ingestion_import_runs
    ADD CONSTRAINT ai_ingestion_import_runs_ingestion_job_id_ai_ingestion_jobs_id_ FOREIGN KEY (ingestion_job_id) REFERENCES public.ai_ingestion_jobs(id);


--
-- Name: ai_ingestion_jobs ai_ingestion_jobs_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_ingestion_jobs
    ADD CONSTRAINT ai_ingestion_jobs_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: ai_ingestion_jobs ai_ingestion_jobs_source_document_id_documents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_ingestion_jobs
    ADD CONSTRAINT ai_ingestion_jobs_source_document_id_documents_id_fk FOREIGN KEY (source_document_id) REFERENCES public.documents(id);


--
-- Name: annual_governance_tasks annual_governance_tasks_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.annual_governance_tasks
    ADD CONSTRAINT annual_governance_tasks_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: annual_governance_tasks annual_governance_tasks_owner_person_id_persons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.annual_governance_tasks
    ADD CONSTRAINT annual_governance_tasks_owner_person_id_persons_id_fk FOREIGN KEY (owner_person_id) REFERENCES public.persons(id);


--
-- Name: annual_governance_tasks annual_governance_tasks_template_id_governance_compliance_templ; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.annual_governance_tasks
    ADD CONSTRAINT annual_governance_tasks_template_id_governance_compliance_templ FOREIGN KEY (template_id) REFERENCES public.governance_compliance_templates(id);


--
-- Name: annual_governance_tasks annual_governance_tasks_template_item_id_governance_template_it; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.annual_governance_tasks
    ADD CONSTRAINT annual_governance_tasks_template_item_id_governance_template_it FOREIGN KEY (template_item_id) REFERENCES public.governance_template_items(id);


--
-- Name: association_assets association_assets_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.association_assets
    ADD CONSTRAINT association_assets_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: association_assets association_assets_unit_id_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.association_assets
    ADD CONSTRAINT association_assets_unit_id_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: association_assets association_assets_vendor_id_vendors_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.association_assets
    ADD CONSTRAINT association_assets_vendor_id_vendors_id_fk FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: association_feature_flags association_feature_flags_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.association_feature_flags
    ADD CONSTRAINT association_feature_flags_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: association_feature_flags association_feature_flags_flag_id_feature_flags_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.association_feature_flags
    ADD CONSTRAINT association_feature_flags_flag_id_feature_flags_id_fk FOREIGN KEY (flag_id) REFERENCES public.feature_flags(id);


--
-- Name: association_insurance_policies association_insurance_policies_association_id_associations_id_f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.association_insurance_policies
    ADD CONSTRAINT association_insurance_policies_association_id_associations_id_f FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: association_memberships association_memberships_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.association_memberships
    ADD CONSTRAINT association_memberships_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: association_memberships association_memberships_person_id_persons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.association_memberships
    ADD CONSTRAINT association_memberships_person_id_persons_id_fk FOREIGN KEY (person_id) REFERENCES public.persons(id);


--
-- Name: association_memberships association_memberships_unit_id_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.association_memberships
    ADD CONSTRAINT association_memberships_unit_id_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: audit_logs audit_logs_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: auth_external_accounts auth_external_accounts_user_id_auth_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_external_accounts
    ADD CONSTRAINT auth_external_accounts_user_id_auth_users_id_fk FOREIGN KEY (user_id) REFERENCES public.auth_users(id);


--
-- Name: auth_users auth_users_admin_user_id_admin_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_users
    ADD CONSTRAINT auth_users_admin_user_id_admin_users_id_fk FOREIGN KEY (admin_user_id) REFERENCES public.admin_users(id);


--
-- Name: autopay_enrollments autopay_enrollments_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autopay_enrollments
    ADD CONSTRAINT autopay_enrollments_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: autopay_enrollments autopay_enrollments_person_id_persons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autopay_enrollments
    ADD CONSTRAINT autopay_enrollments_person_id_persons_id_fk FOREIGN KEY (person_id) REFERENCES public.persons(id);


--
-- Name: autopay_enrollments autopay_enrollments_unit_id_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autopay_enrollments
    ADD CONSTRAINT autopay_enrollments_unit_id_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: autopay_runs autopay_runs_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autopay_runs
    ADD CONSTRAINT autopay_runs_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: autopay_runs autopay_runs_enrollment_id_autopay_enrollments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autopay_runs
    ADD CONSTRAINT autopay_runs_enrollment_id_autopay_enrollments_id_fk FOREIGN KEY (enrollment_id) REFERENCES public.autopay_enrollments(id);


--
-- Name: autopay_runs autopay_runs_ledger_entry_id_owner_ledger_entries_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autopay_runs
    ADD CONSTRAINT autopay_runs_ledger_entry_id_owner_ledger_entries_id_fk FOREIGN KEY (ledger_entry_id) REFERENCES public.owner_ledger_entries(id);


--
-- Name: bank_statement_imports bank_statement_imports_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_statement_imports
    ADD CONSTRAINT bank_statement_imports_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: bank_statement_transactions bank_statement_transactions_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_statement_transactions
    ADD CONSTRAINT bank_statement_transactions_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: bank_statement_transactions bank_statement_transactions_import_id_bank_statement_imports_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_statement_transactions
    ADD CONSTRAINT bank_statement_transactions_import_id_bank_statement_imports_id FOREIGN KEY (import_id) REFERENCES public.bank_statement_imports(id);


--
-- Name: bank_statement_transactions bank_statement_transactions_matched_ledger_entry_id_owner_ledge; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_statement_transactions
    ADD CONSTRAINT bank_statement_transactions_matched_ledger_entry_id_owner_ledge FOREIGN KEY (matched_ledger_entry_id) REFERENCES public.owner_ledger_entries(id);


--
-- Name: board_package_templates board_package_templates_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_package_templates
    ADD CONSTRAINT board_package_templates_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: board_packages board_packages_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_packages
    ADD CONSTRAINT board_packages_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: board_packages board_packages_meeting_id_governance_meetings_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_packages
    ADD CONSTRAINT board_packages_meeting_id_governance_meetings_id_fk FOREIGN KEY (meeting_id) REFERENCES public.governance_meetings(id);


--
-- Name: board_packages board_packages_template_id_board_package_templates_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_packages
    ADD CONSTRAINT board_packages_template_id_board_package_templates_id_fk FOREIGN KEY (template_id) REFERENCES public.board_package_templates(id);


--
-- Name: board_roles board_roles_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_roles
    ADD CONSTRAINT board_roles_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: board_roles board_roles_person_id_persons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_roles
    ADD CONSTRAINT board_roles_person_id_persons_id_fk FOREIGN KEY (person_id) REFERENCES public.persons(id);


--
-- Name: budget_lines budget_lines_account_id_financial_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_lines
    ADD CONSTRAINT budget_lines_account_id_financial_accounts_id_fk FOREIGN KEY (account_id) REFERENCES public.financial_accounts(id);


--
-- Name: budget_lines budget_lines_budget_version_id_budget_versions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_lines
    ADD CONSTRAINT budget_lines_budget_version_id_budget_versions_id_fk FOREIGN KEY (budget_version_id) REFERENCES public.budget_versions(id);


--
-- Name: budget_lines budget_lines_category_id_financial_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_lines
    ADD CONSTRAINT budget_lines_category_id_financial_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.financial_categories(id);


--
-- Name: budget_versions budget_versions_budget_id_budgets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_versions
    ADD CONSTRAINT budget_versions_budget_id_budgets_id_fk FOREIGN KEY (budget_id) REFERENCES public.budgets(id);


--
-- Name: budgets budgets_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: buildings buildings_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buildings
    ADD CONSTRAINT buildings_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: calendar_events calendar_events_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: clause_records clause_records_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clause_records
    ADD CONSTRAINT clause_records_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: clause_records clause_records_extracted_record_id_ai_extracted_records_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clause_records
    ADD CONSTRAINT clause_records_extracted_record_id_ai_extracted_records_id_fk FOREIGN KEY (extracted_record_id) REFERENCES public.ai_extracted_records(id);


--
-- Name: clause_records clause_records_ingestion_job_id_ai_ingestion_jobs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clause_records
    ADD CONSTRAINT clause_records_ingestion_job_id_ai_ingestion_jobs_id_fk FOREIGN KEY (ingestion_job_id) REFERENCES public.ai_ingestion_jobs(id);


--
-- Name: clause_records clause_records_source_document_id_documents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clause_records
    ADD CONSTRAINT clause_records_source_document_id_documents_id_fk FOREIGN KEY (source_document_id) REFERENCES public.documents(id);


--
-- Name: clause_tags clause_tags_clause_record_id_clause_records_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clause_tags
    ADD CONSTRAINT clause_tags_clause_record_id_clause_records_id_fk FOREIGN KEY (clause_record_id) REFERENCES public.clause_records(id);


--
-- Name: collections_handoffs collections_handoffs_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections_handoffs
    ADD CONSTRAINT collections_handoffs_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: collections_handoffs collections_handoffs_person_id_persons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections_handoffs
    ADD CONSTRAINT collections_handoffs_person_id_persons_id_fk FOREIGN KEY (person_id) REFERENCES public.persons(id);


--
-- Name: collections_handoffs collections_handoffs_unit_id_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections_handoffs
    ADD CONSTRAINT collections_handoffs_unit_id_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: communication_history communication_history_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_history
    ADD CONSTRAINT communication_history_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: communication_history communication_history_recipient_person_id_persons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_history
    ADD CONSTRAINT communication_history_recipient_person_id_persons_id_fk FOREIGN KEY (recipient_person_id) REFERENCES public.persons(id);


--
-- Name: community_announcements community_announcements_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_announcements
    ADD CONSTRAINT community_announcements_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: compliance_alert_overrides compliance_alert_overrides_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_alert_overrides
    ADD CONSTRAINT compliance_alert_overrides_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: compliance_alert_overrides compliance_alert_overrides_template_id_governance_compliance_te; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_alert_overrides
    ADD CONSTRAINT compliance_alert_overrides_template_id_governance_compliance_te FOREIGN KEY (template_id) REFERENCES public.governance_compliance_templates(id);


--
-- Name: compliance_alert_overrides compliance_alert_overrides_template_item_id_governance_template; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_alert_overrides
    ADD CONSTRAINT compliance_alert_overrides_template_item_id_governance_template FOREIGN KEY (template_item_id) REFERENCES public.governance_template_items(id);


--
-- Name: contact_update_requests contact_update_requests_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_update_requests
    ADD CONSTRAINT contact_update_requests_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: contact_update_requests contact_update_requests_person_id_persons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_update_requests
    ADD CONSTRAINT contact_update_requests_person_id_persons_id_fk FOREIGN KEY (person_id) REFERENCES public.persons(id);


--
-- Name: contact_update_requests contact_update_requests_portal_access_id_portal_access_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_update_requests
    ADD CONSTRAINT contact_update_requests_portal_access_id_portal_access_id_fk FOREIGN KEY (portal_access_id) REFERENCES public.portal_access(id);


--
-- Name: delinquency_escalations delinquency_escalations_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delinquency_escalations
    ADD CONSTRAINT delinquency_escalations_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: delinquency_escalations delinquency_escalations_person_id_persons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delinquency_escalations
    ADD CONSTRAINT delinquency_escalations_person_id_persons_id_fk FOREIGN KEY (person_id) REFERENCES public.persons(id);


--
-- Name: delinquency_escalations delinquency_escalations_unit_id_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delinquency_escalations
    ADD CONSTRAINT delinquency_escalations_unit_id_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: delinquency_thresholds delinquency_thresholds_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delinquency_thresholds
    ADD CONSTRAINT delinquency_thresholds_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: delinquency_thresholds delinquency_thresholds_notice_template_id_notice_templates_id_f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delinquency_thresholds
    ADD CONSTRAINT delinquency_thresholds_notice_template_id_notice_templates_id_f FOREIGN KEY (notice_template_id) REFERENCES public.notice_templates(id);


--
-- Name: document_tags document_tags_document_id_documents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tags
    ADD CONSTRAINT document_tags_document_id_documents_id_fk FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- Name: document_versions document_versions_document_id_documents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_document_id_documents_id_fk FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- Name: documents documents_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: email_events email_events_email_log_id_email_logs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_events
    ADD CONSTRAINT email_events_email_log_id_email_logs_id_fk FOREIGN KEY (email_log_id) REFERENCES public.email_logs(id);


--
-- Name: email_logs email_logs_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: email_threads email_threads_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_threads
    ADD CONSTRAINT email_threads_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: expense_attachments expense_attachments_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_attachments
    ADD CONSTRAINT expense_attachments_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: financial_accounts financial_accounts_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_accounts
    ADD CONSTRAINT financial_accounts_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: financial_alerts financial_alerts_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_alerts
    ADD CONSTRAINT financial_alerts_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: financial_approvals financial_approvals_approver_id_admin_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_approvals
    ADD CONSTRAINT financial_approvals_approver_id_admin_users_id_fk FOREIGN KEY (approver_id) REFERENCES public.admin_users(id);


--
-- Name: financial_approvals financial_approvals_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_approvals
    ADD CONSTRAINT financial_approvals_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: financial_categories financial_categories_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_categories
    ADD CONSTRAINT financial_categories_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: governance_compliance_templates governance_compliance_templates_association_id_associations_id_; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.governance_compliance_templates
    ADD CONSTRAINT governance_compliance_templates_association_id_associations_id_ FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: governance_compliance_templates governance_compliance_templates_base_template_id_governance_com; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.governance_compliance_templates
    ADD CONSTRAINT governance_compliance_templates_base_template_id_governance_com FOREIGN KEY (base_template_id) REFERENCES public.governance_compliance_templates(id);


--
-- Name: governance_meetings governance_meetings_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.governance_meetings
    ADD CONSTRAINT governance_meetings_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: governance_reminder_rules governance_reminder_rules_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.governance_reminder_rules
    ADD CONSTRAINT governance_reminder_rules_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: governance_template_items governance_template_items_template_id_governance_compliance_tem; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.governance_template_items
    ADD CONSTRAINT governance_template_items_template_id_governance_compliance_tem FOREIGN KEY (template_id) REFERENCES public.governance_compliance_templates(id);


--
-- Name: hoa_fee_schedules hoa_fee_schedules_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hoa_fee_schedules
    ADD CONSTRAINT hoa_fee_schedules_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: inspection_records inspection_records_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_records
    ADD CONSTRAINT inspection_records_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: inspection_records inspection_records_unit_id_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_records
    ADD CONSTRAINT inspection_records_unit_id_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: late_fee_events late_fee_events_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.late_fee_events
    ADD CONSTRAINT late_fee_events_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: late_fee_events late_fee_events_rule_id_late_fee_rules_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.late_fee_events
    ADD CONSTRAINT late_fee_events_rule_id_late_fee_rules_id_fk FOREIGN KEY (rule_id) REFERENCES public.late_fee_rules(id);


--
-- Name: late_fee_rules late_fee_rules_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.late_fee_rules
    ADD CONSTRAINT late_fee_rules_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: maintenance_requests maintenance_requests_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: maintenance_requests maintenance_requests_submitted_by_person_id_persons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_submitted_by_person_id_persons_id_fk FOREIGN KEY (submitted_by_person_id) REFERENCES public.persons(id);


--
-- Name: maintenance_requests maintenance_requests_submitted_by_portal_access_id_portal_acces; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_submitted_by_portal_access_id_portal_acces FOREIGN KEY (submitted_by_portal_access_id) REFERENCES public.portal_access(id);


--
-- Name: maintenance_requests maintenance_requests_unit_id_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_unit_id_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: maintenance_schedule_instances maintenance_schedule_instances_association_id_associations_id_f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_schedule_instances
    ADD CONSTRAINT maintenance_schedule_instances_association_id_associations_id_f FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: maintenance_schedule_instances maintenance_schedule_instances_template_id_maintenance_schedule; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_schedule_instances
    ADD CONSTRAINT maintenance_schedule_instances_template_id_maintenance_schedule FOREIGN KEY (template_id) REFERENCES public.maintenance_schedule_templates(id);


--
-- Name: maintenance_schedule_instances maintenance_schedule_instances_unit_id_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_schedule_instances
    ADD CONSTRAINT maintenance_schedule_instances_unit_id_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: maintenance_schedule_instances maintenance_schedule_instances_vendor_id_vendors_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_schedule_instances
    ADD CONSTRAINT maintenance_schedule_instances_vendor_id_vendors_id_fk FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: maintenance_schedule_instances maintenance_schedule_instances_work_order_id_work_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_schedule_instances
    ADD CONSTRAINT maintenance_schedule_instances_work_order_id_work_orders_id_fk FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id);


--
-- Name: maintenance_schedule_templates maintenance_schedule_templates_association_id_associations_id_f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_schedule_templates
    ADD CONSTRAINT maintenance_schedule_templates_association_id_associations_id_f FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: maintenance_schedule_templates maintenance_schedule_templates_unit_id_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_schedule_templates
    ADD CONSTRAINT maintenance_schedule_templates_unit_id_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: maintenance_schedule_templates maintenance_schedule_templates_vendor_id_vendors_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_schedule_templates
    ADD CONSTRAINT maintenance_schedule_templates_vendor_id_vendors_id_fk FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: meeting_agenda_items meeting_agenda_items_meeting_id_governance_meetings_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_agenda_items
    ADD CONSTRAINT meeting_agenda_items_meeting_id_governance_meetings_id_fk FOREIGN KEY (meeting_id) REFERENCES public.governance_meetings(id);


--
-- Name: meeting_notes meeting_notes_meeting_id_governance_meetings_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_notes
    ADD CONSTRAINT meeting_notes_meeting_id_governance_meetings_id_fk FOREIGN KEY (meeting_id) REFERENCES public.governance_meetings(id);


--
-- Name: notice_sends notice_sends_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notice_sends
    ADD CONSTRAINT notice_sends_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: notice_sends notice_sends_recipient_person_id_persons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notice_sends
    ADD CONSTRAINT notice_sends_recipient_person_id_persons_id_fk FOREIGN KEY (recipient_person_id) REFERENCES public.persons(id);


--
-- Name: notice_sends notice_sends_template_id_notice_templates_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notice_sends
    ADD CONSTRAINT notice_sends_template_id_notice_templates_id_fk FOREIGN KEY (template_id) REFERENCES public.notice_templates(id);


--
-- Name: notice_templates notice_templates_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notice_templates
    ADD CONSTRAINT notice_templates_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: occupancies occupancies_person_id_persons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occupancies
    ADD CONSTRAINT occupancies_person_id_persons_id_fk FOREIGN KEY (person_id) REFERENCES public.persons(id);


--
-- Name: occupancies occupancies_unit_id_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occupancies
    ADD CONSTRAINT occupancies_unit_id_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: onboarding_invites onboarding_invites_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_invites
    ADD CONSTRAINT onboarding_invites_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: onboarding_invites onboarding_invites_unit_id_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_invites
    ADD CONSTRAINT onboarding_invites_unit_id_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: onboarding_submissions onboarding_submissions_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_submissions
    ADD CONSTRAINT onboarding_submissions_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: onboarding_submissions onboarding_submissions_created_occupancy_id_occupancies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_submissions
    ADD CONSTRAINT onboarding_submissions_created_occupancy_id_occupancies_id_fk FOREIGN KEY (created_occupancy_id) REFERENCES public.occupancies(id);


--
-- Name: onboarding_submissions onboarding_submissions_created_ownership_id_ownerships_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_submissions
    ADD CONSTRAINT onboarding_submissions_created_ownership_id_ownerships_id_fk FOREIGN KEY (created_ownership_id) REFERENCES public.ownerships(id);


--
-- Name: onboarding_submissions onboarding_submissions_created_person_id_persons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_submissions
    ADD CONSTRAINT onboarding_submissions_created_person_id_persons_id_fk FOREIGN KEY (created_person_id) REFERENCES public.persons(id);


--
-- Name: onboarding_submissions onboarding_submissions_invite_id_onboarding_invites_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_submissions
    ADD CONSTRAINT onboarding_submissions_invite_id_onboarding_invites_id_fk FOREIGN KEY (invite_id) REFERENCES public.onboarding_invites(id);


--
-- Name: onboarding_submissions onboarding_submissions_unit_id_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_submissions
    ADD CONSTRAINT onboarding_submissions_unit_id_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: owner_ledger_entries owner_ledger_entries_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_ledger_entries
    ADD CONSTRAINT owner_ledger_entries_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: owner_ledger_entries owner_ledger_entries_person_id_persons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_ledger_entries
    ADD CONSTRAINT owner_ledger_entries_person_id_persons_id_fk FOREIGN KEY (person_id) REFERENCES public.persons(id);


--
-- Name: owner_ledger_entries owner_ledger_entries_unit_id_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_ledger_entries
    ADD CONSTRAINT owner_ledger_entries_unit_id_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: owner_payment_links owner_payment_links_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_payment_links
    ADD CONSTRAINT owner_payment_links_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: owner_payment_links owner_payment_links_person_id_persons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_payment_links
    ADD CONSTRAINT owner_payment_links_person_id_persons_id_fk FOREIGN KEY (person_id) REFERENCES public.persons(id);


--
-- Name: owner_payment_links owner_payment_links_unit_id_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_payment_links
    ADD CONSTRAINT owner_payment_links_unit_id_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: ownerships ownerships_person_id_persons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ownerships
    ADD CONSTRAINT ownerships_person_id_persons_id_fk FOREIGN KEY (person_id) REFERENCES public.persons(id);


--
-- Name: ownerships ownerships_unit_id_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ownerships
    ADD CONSTRAINT ownerships_unit_id_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: partial_payment_rules partial_payment_rules_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partial_payment_rules
    ADD CONSTRAINT partial_payment_rules_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: payment_event_transitions payment_event_transitions_webhook_event_id_payment_webhook_even; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_event_transitions
    ADD CONSTRAINT payment_event_transitions_webhook_event_id_payment_webhook_even FOREIGN KEY (webhook_event_id) REFERENCES public.payment_webhook_events(id);


--
-- Name: payment_gateway_connections payment_gateway_connections_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_gateway_connections
    ADD CONSTRAINT payment_gateway_connections_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: payment_method_configs payment_method_configs_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_method_configs
    ADD CONSTRAINT payment_method_configs_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: payment_plans payment_plans_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_plans
    ADD CONSTRAINT payment_plans_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: payment_plans payment_plans_person_id_persons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_plans
    ADD CONSTRAINT payment_plans_person_id_persons_id_fk FOREIGN KEY (person_id) REFERENCES public.persons(id);


--
-- Name: payment_plans payment_plans_unit_id_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_plans
    ADD CONSTRAINT payment_plans_unit_id_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: payment_reminder_rules payment_reminder_rules_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_reminder_rules
    ADD CONSTRAINT payment_reminder_rules_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: payment_reminder_rules payment_reminder_rules_template_id_notice_templates_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_reminder_rules
    ADD CONSTRAINT payment_reminder_rules_template_id_notice_templates_id_fk FOREIGN KEY (template_id) REFERENCES public.notice_templates(id);


--
-- Name: payment_webhook_events payment_webhook_events_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_webhook_events
    ADD CONSTRAINT payment_webhook_events_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: payment_webhook_events payment_webhook_events_payment_link_id_owner_payment_links_id_f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_webhook_events
    ADD CONSTRAINT payment_webhook_events_payment_link_id_owner_payment_links_id_f FOREIGN KEY (payment_link_id) REFERENCES public.owner_payment_links(id);


--
-- Name: payment_webhook_events payment_webhook_events_person_id_persons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_webhook_events
    ADD CONSTRAINT payment_webhook_events_person_id_persons_id_fk FOREIGN KEY (person_id) REFERENCES public.persons(id);


--
-- Name: payment_webhook_events payment_webhook_events_unit_id_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_webhook_events
    ADD CONSTRAINT payment_webhook_events_unit_id_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: permission_change_logs permission_change_logs_user_id_admin_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_change_logs
    ADD CONSTRAINT permission_change_logs_user_id_admin_users_id_fk FOREIGN KEY (user_id) REFERENCES public.admin_users(id);


--
-- Name: permission_envelopes permission_envelopes_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_envelopes
    ADD CONSTRAINT permission_envelopes_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: persons persons_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: portal_access portal_access_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_access
    ADD CONSTRAINT portal_access_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: portal_access portal_access_board_role_id_board_roles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_access
    ADD CONSTRAINT portal_access_board_role_id_board_roles_id_fk FOREIGN KEY (board_role_id) REFERENCES public.board_roles(id);


--
-- Name: portal_access portal_access_person_id_persons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_access
    ADD CONSTRAINT portal_access_person_id_persons_id_fk FOREIGN KEY (person_id) REFERENCES public.persons(id);


--
-- Name: portal_access portal_access_unit_id_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_access
    ADD CONSTRAINT portal_access_unit_id_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: portal_login_tokens portal_login_tokens_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_login_tokens
    ADD CONSTRAINT portal_login_tokens_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: reconciliation_periods reconciliation_periods_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_periods
    ADD CONSTRAINT reconciliation_periods_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: reconciliation_periods reconciliation_periods_import_id_bank_statement_imports_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_periods
    ADD CONSTRAINT reconciliation_periods_import_id_bank_statement_imports_id_fk FOREIGN KEY (import_id) REFERENCES public.bank_statement_imports(id);


--
-- Name: recurring_charge_runs recurring_charge_runs_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_charge_runs
    ADD CONSTRAINT recurring_charge_runs_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: recurring_charge_runs recurring_charge_runs_ledger_entry_id_owner_ledger_entries_id_f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_charge_runs
    ADD CONSTRAINT recurring_charge_runs_ledger_entry_id_owner_ledger_entries_id_f FOREIGN KEY (ledger_entry_id) REFERENCES public.owner_ledger_entries(id);


--
-- Name: recurring_charge_runs recurring_charge_runs_schedule_id_recurring_charge_schedules_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_charge_runs
    ADD CONSTRAINT recurring_charge_runs_schedule_id_recurring_charge_schedules_id FOREIGN KEY (schedule_id) REFERENCES public.recurring_charge_schedules(id);


--
-- Name: recurring_charge_runs recurring_charge_runs_unit_id_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_charge_runs
    ADD CONSTRAINT recurring_charge_runs_unit_id_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: recurring_charge_schedules recurring_charge_schedules_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_charge_schedules
    ADD CONSTRAINT recurring_charge_schedules_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: recurring_charge_schedules recurring_charge_schedules_unit_id_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_charge_schedules
    ADD CONSTRAINT recurring_charge_schedules_unit_id_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: resident_feedbacks resident_feedbacks_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resident_feedbacks
    ADD CONSTRAINT resident_feedbacks_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: resident_feedbacks resident_feedbacks_person_id_persons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resident_feedbacks
    ADD CONSTRAINT resident_feedbacks_person_id_persons_id_fk FOREIGN KEY (person_id) REFERENCES public.persons(id);


--
-- Name: resident_feedbacks resident_feedbacks_unit_id_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resident_feedbacks
    ADD CONSTRAINT resident_feedbacks_unit_id_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: resolutions resolutions_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resolutions
    ADD CONSTRAINT resolutions_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: resolutions resolutions_meeting_id_governance_meetings_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resolutions
    ADD CONSTRAINT resolutions_meeting_id_governance_meetings_id_fk FOREIGN KEY (meeting_id) REFERENCES public.governance_meetings(id);


--
-- Name: saved_payment_methods saved_payment_methods_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_payment_methods
    ADD CONSTRAINT saved_payment_methods_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: saved_payment_methods saved_payment_methods_person_id_persons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_payment_methods
    ADD CONSTRAINT saved_payment_methods_person_id_persons_id_fk FOREIGN KEY (person_id) REFERENCES public.persons(id);


--
-- Name: special_assessments special_assessments_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.special_assessments
    ADD CONSTRAINT special_assessments_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: suggested_links suggested_links_clause_record_id_clause_records_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggested_links
    ADD CONSTRAINT suggested_links_clause_record_id_clause_records_id_fk FOREIGN KEY (clause_record_id) REFERENCES public.clause_records(id);


--
-- Name: tenant_configs tenant_configs_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_configs
    ADD CONSTRAINT tenant_configs_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: unit_change_history unit_change_history_unit_id_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_change_history
    ADD CONSTRAINT unit_change_history_unit_id_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: units units_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: utility_payments utility_payments_account_id_financial_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utility_payments
    ADD CONSTRAINT utility_payments_account_id_financial_accounts_id_fk FOREIGN KEY (account_id) REFERENCES public.financial_accounts(id);


--
-- Name: utility_payments utility_payments_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utility_payments
    ADD CONSTRAINT utility_payments_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: utility_payments utility_payments_category_id_financial_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utility_payments
    ADD CONSTRAINT utility_payments_category_id_financial_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.financial_categories(id);


--
-- Name: vendor_invoices vendor_invoices_account_id_financial_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_invoices
    ADD CONSTRAINT vendor_invoices_account_id_financial_accounts_id_fk FOREIGN KEY (account_id) REFERENCES public.financial_accounts(id);


--
-- Name: vendor_invoices vendor_invoices_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_invoices
    ADD CONSTRAINT vendor_invoices_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: vendor_invoices vendor_invoices_category_id_financial_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_invoices
    ADD CONSTRAINT vendor_invoices_category_id_financial_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.financial_categories(id);


--
-- Name: vendor_invoices vendor_invoices_vendor_id_vendors_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_invoices
    ADD CONSTRAINT vendor_invoices_vendor_id_vendors_id_fk FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: vendors vendors_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: vote_records vote_records_resolution_id_resolutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vote_records
    ADD CONSTRAINT vote_records_resolution_id_resolutions_id_fk FOREIGN KEY (resolution_id) REFERENCES public.resolutions(id);


--
-- Name: vote_records vote_records_voter_person_id_persons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vote_records
    ADD CONSTRAINT vote_records_voter_person_id_persons_id_fk FOREIGN KEY (voter_person_id) REFERENCES public.persons(id);


--
-- Name: webhook_signing_secrets webhook_signing_secrets_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_signing_secrets
    ADD CONSTRAINT webhook_signing_secrets_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: work_orders work_orders_association_id_associations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_association_id_associations_id_fk FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- Name: work_orders work_orders_maintenance_request_id_maintenance_requests_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_maintenance_request_id_maintenance_requests_id_fk FOREIGN KEY (maintenance_request_id) REFERENCES public.maintenance_requests(id);


--
-- Name: work_orders work_orders_unit_id_units_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_unit_id_units_id_fk FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: work_orders work_orders_vendor_id_vendors_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_vendor_id_vendors_id_fk FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: work_orders work_orders_vendor_invoice_id_vendor_invoices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_vendor_invoice_id_vendor_invoices_id_fk FOREIGN KEY (vendor_invoice_id) REFERENCES public.vendor_invoices(id);


--
-- PostgreSQL database dump complete
--

\unrestrict kKbPzTM5j5DXMneu6Q7MDdOYTnyWlTYwggjXZvynMSw5tTAsTmmFF89swuMtGhj

