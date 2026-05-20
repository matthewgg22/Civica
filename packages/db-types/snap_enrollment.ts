export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  snap_enrollment: {
    Tables: {
      applicants: {
        Row: {
          address_ciphertext: string | null
          applicant_id: string
          auth_uid: string | null
          created_at: string
          date_of_birth_ciphertext: string | null
          email_ciphertext: string | null
          full_name_ciphertext: string | null
          phone_ciphertext: string | null
          preferred_language: string
          state_code: Database["snap_enrollment"]["Enums"]["launch_state"]
          updated_at: string
        }
        Insert: {
          address_ciphertext?: string | null
          applicant_id?: string
          auth_uid?: string | null
          created_at?: string
          date_of_birth_ciphertext?: string | null
          email_ciphertext?: string | null
          full_name_ciphertext?: string | null
          phone_ciphertext?: string | null
          preferred_language?: string
          state_code: Database["snap_enrollment"]["Enums"]["launch_state"]
          updated_at?: string
        }
        Update: {
          address_ciphertext?: string | null
          applicant_id?: string
          auth_uid?: string | null
          created_at?: string
          date_of_birth_ciphertext?: string | null
          email_ciphertext?: string | null
          full_name_ciphertext?: string | null
          phone_ciphertext?: string | null
          preferred_language?: string
          state_code?: Database["snap_enrollment"]["Enums"]["launch_state"]
          updated_at?: string
        }
        Relationships: []
      }
      audit_log_events: {
        Row: {
          actor_id: string | null
          actor_kind: Database["snap_enrollment"]["Enums"]["audit_actor_kind"]
          applicant_id: string | null
          audit_id: string
          changed_columns: string[] | null
          ip_address: string | null
          new_values: Json | null
          occurred_at: string
          old_values: Json | null
          operation: string
          packet_id: string | null
          request_id: string | null
          row_id: string
          table_name: string
          user_agent: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_kind: Database["snap_enrollment"]["Enums"]["audit_actor_kind"]
          applicant_id?: string | null
          audit_id?: string
          changed_columns?: string[] | null
          ip_address?: string | null
          new_values?: Json | null
          occurred_at?: string
          old_values?: Json | null
          operation: string
          packet_id?: string | null
          request_id?: string | null
          row_id: string
          table_name: string
          user_agent?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_kind?: Database["snap_enrollment"]["Enums"]["audit_actor_kind"]
          applicant_id?: string | null
          audit_id?: string
          changed_columns?: string[] | null
          ip_address?: string | null
          new_values?: Json | null
          occurred_at?: string
          old_values?: Json | null
          operation?: string
          packet_id?: string | null
          request_id?: string | null
          row_id?: string
          table_name?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      document_extractions: {
        Row: {
          document_id: string
          extracted_at: string
          extraction_flags: Json
          extraction_id: string
          extractor_model: string
          extractor_version: string
          overall_confidence: number
          raw_ocr_ciphertext: string | null
        }
        Insert: {
          document_id: string
          extracted_at?: string
          extraction_flags?: Json
          extraction_id?: string
          extractor_model: string
          extractor_version: string
          overall_confidence: number
          raw_ocr_ciphertext?: string | null
        }
        Update: {
          document_id?: string
          extracted_at?: string
          extraction_flags?: Json
          extraction_id?: string
          extractor_model?: string
          extractor_version?: string
          overall_confidence?: number
          raw_ocr_ciphertext?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_extractions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "uploaded_documents"
            referencedColumns: ["document_id"]
          },
        ]
      }
      enrollment_config: {
        Row: {
          key: string
          note: string | null
          value: string
        }
        Insert: {
          key: string
          note?: string | null
          value: string
        }
        Update: {
          key?: string
          note?: string | null
          value?: string
        }
        Relationships: []
      }
      extraction_fields: {
        Row: {
          applicant_answer: string | null
          confidence: number
          created_at: string
          extraction_id: string
          field_id: string
          field_key: string
          field_label: string
          navigator_confirmed_value: string | null
          needs_review: boolean
          original_ocr_value: string | null
          packet_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by_staff_id: string | null
          updated_at: string
        }
        Insert: {
          applicant_answer?: string | null
          confidence: number
          created_at?: string
          extraction_id: string
          field_id?: string
          field_key: string
          field_label: string
          navigator_confirmed_value?: string | null
          needs_review?: boolean
          original_ocr_value?: string | null
          packet_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by_staff_id?: string | null
          updated_at?: string
        }
        Update: {
          applicant_answer?: string | null
          confidence?: number
          created_at?: string
          extraction_id?: string
          field_id?: string
          field_key?: string
          field_label?: string
          navigator_confirmed_value?: string | null
          needs_review?: boolean
          original_ocr_value?: string | null
          packet_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by_staff_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extraction_fields_extraction_id_fkey"
            columns: ["extraction_id"]
            isOneToOne: false
            referencedRelation: "document_extractions"
            referencedColumns: ["extraction_id"]
          },
          {
            foreignKeyName: "extraction_fields_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "snap_packets"
            referencedColumns: ["packet_id"]
          },
          {
            foreignKeyName: "extraction_fields_reviewed_by_staff_id_fkey"
            columns: ["reviewed_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["staff_id"]
          },
        ]
      }
      handoff_exports: {
        Row: {
          agency_reference: string | null
          checksum_sha256: string | null
          export_id: string
          exported_at: string
          exported_by_staff_id: string
          format: Database["snap_enrollment"]["Enums"]["handoff_format"]
          packet_id: string
          storage_path: string | null
        }
        Insert: {
          agency_reference?: string | null
          checksum_sha256?: string | null
          export_id?: string
          exported_at?: string
          exported_by_staff_id: string
          format: Database["snap_enrollment"]["Enums"]["handoff_format"]
          packet_id: string
          storage_path?: string | null
        }
        Update: {
          agency_reference?: string | null
          checksum_sha256?: string | null
          export_id?: string
          exported_at?: string
          exported_by_staff_id?: string
          format?: Database["snap_enrollment"]["Enums"]["handoff_format"]
          packet_id?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "handoff_exports_exported_by_staff_id_fkey"
            columns: ["exported_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "handoff_exports_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "snap_packets"
            referencedColumns: ["packet_id"]
          },
        ]
      }
      missing_item_requests: {
        Row: {
          message_ciphertext: string | null
          packet_id: string
          request_id: string
          requested_by_staff_id: string
          required_item_id: string | null
          resolved_at: string | null
          resolved_by_staff_id: string | null
          sent_at: string
          status: Database["snap_enrollment"]["Enums"]["missing_item_status"]
          updated_at: string
        }
        Insert: {
          message_ciphertext?: string | null
          packet_id: string
          request_id?: string
          requested_by_staff_id: string
          required_item_id?: string | null
          resolved_at?: string | null
          resolved_by_staff_id?: string | null
          sent_at?: string
          status?: Database["snap_enrollment"]["Enums"]["missing_item_status"]
          updated_at?: string
        }
        Update: {
          message_ciphertext?: string | null
          packet_id?: string
          request_id?: string
          requested_by_staff_id?: string
          required_item_id?: string | null
          resolved_at?: string | null
          resolved_by_staff_id?: string | null
          sent_at?: string
          status?: Database["snap_enrollment"]["Enums"]["missing_item_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "missing_item_requests_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "snap_packets"
            referencedColumns: ["packet_id"]
          },
          {
            foreignKeyName: "missing_item_requests_requested_by_staff_id_fkey"
            columns: ["requested_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "missing_item_requests_required_item_id_fkey"
            columns: ["required_item_id"]
            isOneToOne: false
            referencedRelation: "required_document_items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "missing_item_requests_resolved_by_staff_id_fkey"
            columns: ["resolved_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["staff_id"]
          },
        ]
      }
      navigator_notes: {
        Row: {
          author_staff_id: string
          body_ciphertext: string
          created_at: string
          deleted_at: string | null
          is_internal: boolean
          note_id: string
          packet_id: string
          updated_at: string
        }
        Insert: {
          author_staff_id: string
          body_ciphertext: string
          created_at?: string
          deleted_at?: string | null
          is_internal?: boolean
          note_id?: string
          packet_id: string
          updated_at?: string
        }
        Update: {
          author_staff_id?: string
          body_ciphertext?: string
          created_at?: string
          deleted_at?: string | null
          is_internal?: boolean
          note_id?: string
          packet_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "navigator_notes_author_staff_id_fkey"
            columns: ["author_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "navigator_notes_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "snap_packets"
            referencedColumns: ["packet_id"]
          },
        ]
      }
      packet_answers: {
        Row: {
          answer_id: string
          answer_source: string
          applicant_answer: string | null
          created_at: string
          navigator_confirmed_value: string | null
          original_ocr_value: string | null
          packet_id: string
          question_key: string
          question_label: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by_staff_id: string | null
          updated_at: string
        }
        Insert: {
          answer_id?: string
          answer_source: string
          applicant_answer?: string | null
          created_at?: string
          navigator_confirmed_value?: string | null
          original_ocr_value?: string | null
          packet_id: string
          question_key: string
          question_label: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by_staff_id?: string | null
          updated_at?: string
        }
        Update: {
          answer_id?: string
          answer_source?: string
          applicant_answer?: string | null
          created_at?: string
          navigator_confirmed_value?: string | null
          original_ocr_value?: string | null
          packet_id?: string
          question_key?: string
          question_label?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by_staff_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packet_answers_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "snap_packets"
            referencedColumns: ["packet_id"]
          },
          {
            foreignKeyName: "packet_answers_reviewed_by_staff_id_fkey"
            columns: ["reviewed_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["staff_id"]
          },
        ]
      }
      packet_assignments: {
        Row: {
          assigned_at: string
          assigned_by_staff_id: string | null
          assignment_id: string
          is_current: boolean
          packet_id: string
          staff_id: string
          unassign_reason: string | null
          unassigned_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by_staff_id?: string | null
          assignment_id?: string
          is_current?: boolean
          packet_id: string
          staff_id: string
          unassign_reason?: string | null
          unassigned_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by_staff_id?: string | null
          assignment_id?: string
          is_current?: boolean
          packet_id?: string
          staff_id?: string
          unassign_reason?: string | null
          unassigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "packet_assignments_assigned_by_staff_id_fkey"
            columns: ["assigned_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "packet_assignments_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "snap_packets"
            referencedColumns: ["packet_id"]
          },
          {
            foreignKeyName: "packet_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["staff_id"]
          },
        ]
      }
      packet_status_history: {
        Row: {
          changed_by_applicant_id: string | null
          changed_by_staff_id: string | null
          from_status:
            | Database["snap_enrollment"]["Enums"]["packet_status"]
            | null
          history_id: string
          occurred_at: string
          packet_id: string
          reason: string | null
          to_status: Database["snap_enrollment"]["Enums"]["packet_status"]
        }
        Insert: {
          changed_by_applicant_id?: string | null
          changed_by_staff_id?: string | null
          from_status?:
            | Database["snap_enrollment"]["Enums"]["packet_status"]
            | null
          history_id?: string
          occurred_at?: string
          packet_id: string
          reason?: string | null
          to_status: Database["snap_enrollment"]["Enums"]["packet_status"]
        }
        Update: {
          changed_by_applicant_id?: string | null
          changed_by_staff_id?: string | null
          from_status?:
            | Database["snap_enrollment"]["Enums"]["packet_status"]
            | null
          history_id?: string
          occurred_at?: string
          packet_id?: string
          reason?: string | null
          to_status?: Database["snap_enrollment"]["Enums"]["packet_status"]
        }
        Relationships: [
          {
            foreignKeyName: "packet_status_history_changed_by_applicant_id_fkey"
            columns: ["changed_by_applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["applicant_id"]
          },
          {
            foreignKeyName: "packet_status_history_changed_by_staff_id_fkey"
            columns: ["changed_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "packet_status_history_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "snap_packets"
            referencedColumns: ["packet_id"]
          },
        ]
      }
      pii_columns: {
        Row: {
          column_name: string
          table_name: string
          table_schema: string
        }
        Insert: {
          column_name: string
          table_name: string
          table_schema: string
        }
        Update: {
          column_name?: string
          table_name?: string
          table_schema?: string
        }
        Relationships: []
      }
      required_document_items: {
        Row: {
          created_at: string
          document_kind: Database["snap_enrollment"]["Enums"]["document_kind"]
          is_required: boolean
          item_id: string
          label: string
          packet_id: string
          resolved_at: string | null
          resolved_document_id: string | null
          state_code: Database["snap_enrollment"]["Enums"]["launch_state"]
          updated_at: string
          waive_reason: string | null
          waived_at: string | null
          waived_by_staff_id: string | null
        }
        Insert: {
          created_at?: string
          document_kind: Database["snap_enrollment"]["Enums"]["document_kind"]
          is_required?: boolean
          item_id?: string
          label: string
          packet_id: string
          resolved_at?: string | null
          resolved_document_id?: string | null
          state_code: Database["snap_enrollment"]["Enums"]["launch_state"]
          updated_at?: string
          waive_reason?: string | null
          waived_at?: string | null
          waived_by_staff_id?: string | null
        }
        Update: {
          created_at?: string
          document_kind?: Database["snap_enrollment"]["Enums"]["document_kind"]
          is_required?: boolean
          item_id?: string
          label?: string
          packet_id?: string
          resolved_at?: string | null
          resolved_document_id?: string | null
          state_code?: Database["snap_enrollment"]["Enums"]["launch_state"]
          updated_at?: string
          waive_reason?: string | null
          waived_at?: string | null
          waived_by_staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "required_document_items_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "snap_packets"
            referencedColumns: ["packet_id"]
          },
          {
            foreignKeyName: "required_document_items_resolved_document_id_fkey"
            columns: ["resolved_document_id"]
            isOneToOne: false
            referencedRelation: "uploaded_documents"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "required_document_items_waived_by_staff_id_fkey"
            columns: ["waived_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["staff_id"]
          },
        ]
      }
      snap_packets: {
        Row: {
          applicant_id: string
          closed_at: string | null
          county: string | null
          county_fips: string | null
          created_at: string
          deleted_at: string | null
          handed_off_at: string | null
          is_expedited: boolean | null
          notes_for_applicant: string | null
          org_id: string | null
          packet_id: string
          state_code: Database["snap_enrollment"]["Enums"]["launch_state"]
          status: Database["snap_enrollment"]["Enums"]["packet_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          applicant_id: string
          closed_at?: string | null
          county?: string | null
          county_fips?: string | null
          created_at?: string
          deleted_at?: string | null
          handed_off_at?: string | null
          is_expedited?: boolean | null
          notes_for_applicant?: string | null
          org_id?: string | null
          packet_id?: string
          state_code: Database["snap_enrollment"]["Enums"]["launch_state"]
          status?: Database["snap_enrollment"]["Enums"]["packet_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          closed_at?: string | null
          county?: string | null
          county_fips?: string | null
          created_at?: string
          deleted_at?: string | null
          handed_off_at?: string | null
          is_expedited?: boolean | null
          notes_for_applicant?: string | null
          org_id?: string | null
          packet_id?: string
          state_code?: Database["snap_enrollment"]["Enums"]["launch_state"]
          status?: Database["snap_enrollment"]["Enums"]["packet_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "snap_packets_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["applicant_id"]
          },
          {
            foreignKeyName: "snap_packets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "staff_orgs"
            referencedColumns: ["org_id"]
          },
        ]
      }
      staff_orgs: {
        Row: {
          created_at: string
          deleted_at: string | null
          name: string
          org_id: string
          state_code: Database["snap_enrollment"]["Enums"]["launch_state"]
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          name: string
          org_id?: string
          state_code: Database["snap_enrollment"]["Enums"]["launch_state"]
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          name?: string
          org_id?: string
          state_code?: Database["snap_enrollment"]["Enums"]["launch_state"]
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      staff_roles: {
        Row: {
          can_export: boolean
          can_override_status: boolean
          can_view_pii: boolean
          created_at: string
          label: string
          org_id: string
          role_id: string
          role_kind: Database["snap_enrollment"]["Enums"]["staff_role_kind"]
        }
        Insert: {
          can_export?: boolean
          can_override_status?: boolean
          can_view_pii?: boolean
          created_at?: string
          label: string
          org_id: string
          role_id?: string
          role_kind: Database["snap_enrollment"]["Enums"]["staff_role_kind"]
        }
        Update: {
          can_export?: boolean
          can_override_status?: boolean
          can_view_pii?: boolean
          created_at?: string
          label?: string
          org_id?: string
          role_id?: string
          role_kind?: Database["snap_enrollment"]["Enums"]["staff_role_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "staff_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "staff_orgs"
            referencedColumns: ["org_id"]
          },
        ]
      }
      staff_users: {
        Row: {
          auth_uid: string
          created_at: string
          deleted_at: string | null
          display_name: string
          email: string
          org_id: string
          role_id: string
          staff_id: string
          updated_at: string
        }
        Insert: {
          auth_uid: string
          created_at?: string
          deleted_at?: string | null
          display_name: string
          email: string
          org_id: string
          role_id: string
          staff_id?: string
          updated_at?: string
        }
        Update: {
          auth_uid?: string
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          email?: string
          org_id?: string
          role_id?: string
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "staff_orgs"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "staff_users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "staff_roles"
            referencedColumns: ["role_id"]
          },
        ]
      }
      uploaded_documents: {
        Row: {
          applicant_id: string
          classification_confidence: number | null
          deleted_at: string | null
          document_id: string
          document_kind: Database["snap_enrollment"]["Enums"]["document_kind"]
          on_device_quality_passed: boolean
          original_filename: string | null
          packet_id: string
          processing_status: string
          rejected_reason: string | null
          storage_path: string
          updated_at: string
          uploaded_at: string
        }
        Insert: {
          applicant_id: string
          classification_confidence?: number | null
          deleted_at?: string | null
          document_id?: string
          document_kind?: Database["snap_enrollment"]["Enums"]["document_kind"]
          on_device_quality_passed?: boolean
          original_filename?: string | null
          packet_id: string
          processing_status?: string
          rejected_reason?: string | null
          storage_path: string
          updated_at?: string
          uploaded_at?: string
        }
        Update: {
          applicant_id?: string
          classification_confidence?: number | null
          deleted_at?: string | null
          document_id?: string
          document_kind?: Database["snap_enrollment"]["Enums"]["document_kind"]
          on_device_quality_passed?: boolean
          original_filename?: string | null
          packet_id?: string
          processing_status?: string
          rejected_reason?: string | null
          storage_path?: string
          updated_at?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_documents_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["applicant_id"]
          },
          {
            foreignKeyName: "uploaded_documents_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "snap_packets"
            referencedColumns: ["packet_id"]
          },
        ]
      }
      user_consents: {
        Row: {
          applicant_id: string
          consent_id: string
          consent_kind: Database["snap_enrollment"]["Enums"]["consent_kind"]
          consent_method: string
          consented_at: string
          ip_address: string | null
          policy_version: string
          revoke_reason: string | null
          revoked_at: string | null
        }
        Insert: {
          applicant_id: string
          consent_id?: string
          consent_kind: Database["snap_enrollment"]["Enums"]["consent_kind"]
          consent_method: string
          consented_at?: string
          ip_address?: string | null
          policy_version: string
          revoke_reason?: string | null
          revoked_at?: string | null
        }
        Update: {
          applicant_id?: string
          consent_id?: string
          consent_kind?: Database["snap_enrollment"]["Enums"]["consent_kind"]
          consent_method?: string
          consented_at?: string
          ip_address?: string | null
          policy_version?: string
          revoke_reason?: string | null
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_consents_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["applicant_id"]
          },
        ]
      }
      recertifications: {
        Row: {
          recert_id: string
          packet_id: string
          org_id: string
          applicant_id: string
          cert_period_end: string
          cert_period_end_source: string
          reminder_opted_in: boolean
          first_reminder_sent_at: string | null
          second_reminder_sent_at: string | null
          day_of_reminder_sent_at: string | null
          phone_prep_sent_at: string | null
          post_interview_captured_at: string | null
          practice_session_count: number
          last_practice_at: string | null
          refreshed_packet_id: string | null
          refresh_triggered_at: string | null
          refresh_completed_at: string | null
          status: string
          outcome_recorded_at: string | null
          outcome_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          recert_id?: string
          packet_id: string
          org_id: string
          applicant_id?: string
          cert_period_end: string
          cert_period_end_source: string
          reminder_opted_in?: boolean
          first_reminder_sent_at?: string | null
          second_reminder_sent_at?: string | null
          day_of_reminder_sent_at?: string | null
          phone_prep_sent_at?: string | null
          post_interview_captured_at?: string | null
          practice_session_count?: number
          last_practice_at?: string | null
          refreshed_packet_id?: string | null
          refresh_triggered_at?: string | null
          refresh_completed_at?: string | null
          status?: string
          outcome_recorded_at?: string | null
          outcome_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          recert_id?: string
          packet_id?: string
          org_id?: string
          applicant_id?: string
          cert_period_end?: string
          cert_period_end_source?: string
          reminder_opted_in?: boolean
          first_reminder_sent_at?: string | null
          second_reminder_sent_at?: string | null
          day_of_reminder_sent_at?: string | null
          phone_prep_sent_at?: string | null
          post_interview_captured_at?: string | null
          practice_session_count?: number
          last_practice_at?: string | null
          refreshed_packet_id?: string | null
          refresh_triggered_at?: string | null
          refresh_completed_at?: string | null
          status?: string
          outcome_recorded_at?: string | null
          outcome_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      recert_practice_scores: {
        Row: {
          score_id: string
          session_id: string
          overall_score: number
          strengths: Json
          improvements: Json
          summary_en: string
          summary_es: string
          engine_version: string
          generated_at: string
          created_at: string
        }
        Insert: {
          score_id?: string
          session_id: string
          overall_score: number
          strengths: Json
          improvements: Json
          summary_en: string
          summary_es: string
          engine_version: string
          generated_at?: string
          created_at?: string
        }
        Update: {
          score_id?: string
          session_id?: string
          overall_score?: number
          strengths?: Json
          improvements?: Json
          summary_en?: string
          summary_es?: string
          engine_version?: string
          generated_at?: string
          created_at?: string
        }
        Relationships: []
      }
      recert_practice_sessions: {
        Row: {
          session_id: string
          recert_id: string
          org_id: string
          started_at: string
          completed_at: string | null
          turn_count: number
          done: boolean
          state_code: string | null
          ai_session_ref: string | null
          flags: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          session_id?: string
          recert_id: string
          org_id: string
          started_at?: string
          completed_at?: string | null
          turn_count?: number
          done?: boolean
          state_code?: string | null
          ai_session_ref?: string | null
          flags?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          session_id?: string
          recert_id?: string
          org_id?: string
          started_at?: string
          completed_at?: string | null
          turn_count?: number
          done?: boolean
          state_code?: string | null
          ai_session_ref?: string | null
          flags?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      recert_practice_turns: {
        Row: {
          turn_id: string
          session_id: string
          turn_index: number
          caseworker_question: string
          applicant_response: string | null
          coaching: Json | null
          audio_bytes_duration: number | null
          asked_at: string
          responded_at: string | null
        }
        Insert: {
          turn_id?: string
          session_id: string
          turn_index: number
          caseworker_question: string
          applicant_response?: string | null
          coaching?: Json | null
          audio_bytes_duration?: number | null
          asked_at?: string
          responded_at?: string | null
        }
        Update: {
          turn_id?: string
          session_id?: string
          turn_index?: number
          caseworker_question?: string
          applicant_response?: string | null
          coaching?: Json | null
          audio_bytes_duration?: number | null
          asked_at?: string
          responded_at?: string | null
        }
        Relationships: []
      }
      work_requirement_statuses: {
        Row: {
          wr_status_id: string
          packet_id: string
          org_id: string
          applicant_id: string
          is_subject: boolean
          subject_member_ids: string[]
          determination_basis: string
          determined_at: string
          exemption_type: string | null
          exemption_documented_at: string | null
          exemption_expires_at: string | null
          exemption_notes: string | null
          compliance_status: string
          hours_reported_per_week: number | null
          compliance_verified_at: string | null
          compliance_notes: string | null
          months_used_in_window: number
          window_start_date: string | null
          time_limit_reached_at: string | null
          last_reviewed_by: string | null
          last_reviewed_at: string | null
          next_review_due: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          wr_status_id?: string
          packet_id: string
          org_id: string
          applicant_id: string
          is_subject: boolean
          subject_member_ids?: string[]
          determination_basis: string
          determined_at?: string
          exemption_type?: string | null
          exemption_documented_at?: string | null
          exemption_expires_at?: string | null
          exemption_notes?: string | null
          compliance_status?: string
          hours_reported_per_week?: number | null
          compliance_verified_at?: string | null
          compliance_notes?: string | null
          months_used_in_window?: number
          window_start_date?: string | null
          time_limit_reached_at?: string | null
          last_reviewed_by?: string | null
          last_reviewed_at?: string | null
          next_review_due?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          wr_status_id?: string
          packet_id?: string
          org_id?: string
          applicant_id?: string
          is_subject?: boolean
          subject_member_ids?: string[]
          determination_basis?: string
          determined_at?: string
          exemption_type?: string | null
          exemption_documented_at?: string | null
          exemption_expires_at?: string | null
          exemption_notes?: string | null
          compliance_status?: string
          hours_reported_per_week?: number | null
          compliance_verified_at?: string | null
          compliance_notes?: string | null
          months_used_in_window?: number
          window_start_date?: string | null
          time_limit_reached_at?: string | null
          last_reviewed_by?: string | null
          last_reviewed_at?: string | null
          next_review_due?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      work_requirement_events: {
        Row: {
          event_id: string
          wr_status_id: string
          org_id: string
          actor_id: string
          event_type: string
          payload: Json
          created_at: string
        }
        Insert: {
          event_id?: string
          wr_status_id: string
          org_id: string
          actor_id: string
          event_type: string
          payload: Json
          created_at?: string
        }
        Update: {
          event_id?: string
          wr_status_id?: string
          org_id?: string
          actor_id?: string
          event_type?: string
          payload?: Json
          created_at?: string
        }
        Relationships: []
      }
      benefitscal_submissions: {
        Row: {
          submission_id: string
          packet_id: string
          org_id: string
          payload_json: Json
          status: string
          benefitscal_confirmation_number: string | null
          submitted_at: string | null
          submitted_by: string | null
          assister_account_id: string | null
          consent_type: string
          telephonic_consent_recorded_at: string | null
          error_message: string | null
          retry_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          submission_id?: string
          packet_id: string
          org_id: string
          payload_json: Json
          status?: string
          benefitscal_confirmation_number?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          assister_account_id?: string | null
          consent_type: string
          telephonic_consent_recorded_at?: string | null
          error_message?: string | null
          retry_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          submission_id?: string
          packet_id?: string
          org_id?: string
          payload_json?: Json
          status?: string
          benefitscal_confirmation_number?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          assister_account_id?: string | null
          consent_type?: string
          telephonic_consent_recorded_at?: string | null
          error_message?: string | null
          retry_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      recert_outreach_log: {
        Row: {
          log_id: string
          recert_id: string
          org_id: string
          outreach_type: string
          to_phone: string
          body_preview: string | null
          twilio_message_sid: string | null
          status: string
          error_message: string | null
          sent_at: string | null
          created_at: string
        }
        Insert: {
          log_id?: string
          recert_id: string
          org_id: string
          outreach_type: string
          to_phone: string
          body_preview?: string | null
          twilio_message_sid?: string | null
          status?: string
          error_message?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          log_id?: string
          recert_id?: string
          org_id?: string
          outreach_type?: string
          to_phone?: string
          body_preview?: string | null
          twilio_message_sid?: string | null
          status?: string
          error_message?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      recert_outreach_optouts: {
        Row: {
          optout_id: string
          phone_hash: string
          opted_out_at: string
          opted_in_at: string | null
        }
        Insert: {
          optout_id?: string
          phone_hash: string
          opted_out_at?: string
          opted_in_at?: string | null
        }
        Update: {
          optout_id?: string
          phone_hash?: string
          opted_out_at?: string
          opted_in_at?: string | null
        }
        Relationships: []
      }
      // ── T-DR3-7: marketplace cliff event navigator outreach ──────────────
      navigator_outreach_queue: {
        Row: {
          outreach_task_id: string
          packet_id: string
          org_id: string
          applicant_id: string
          reason: 'cliff_event' | 'manual'
          income_usd: number | null
          sla_hours: number
          due_at: string
          status: 'pending' | 'contacted' | 'resolved' | 'cancelled'
          contacted_at: string | null
          resolved_at: string | null
          resolution_notes: string | null
          created_by: string
          assigned_to: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          outreach_task_id?: string
          packet_id: string
          org_id: string
          applicant_id: string
          reason: 'cliff_event' | 'manual'
          income_usd?: number | null
          sla_hours?: number
          due_at: string
          status?: 'pending' | 'contacted' | 'resolved' | 'cancelled'
          contacted_at?: string | null
          resolved_at?: string | null
          resolution_notes?: string | null
          created_by: string
          assigned_to?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          outreach_task_id?: string
          packet_id?: string
          org_id?: string
          applicant_id?: string
          reason?: 'cliff_event' | 'manual'
          income_usd?: number | null
          sla_hours?: number
          due_at?: string
          status?: 'pending' | 'contacted' | 'resolved' | 'cancelled'
          contacted_at?: string | null
          resolved_at?: string | null
          resolution_notes?: string | null
          created_by?: string
          assigned_to?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      // ── T-DR3-8: Argyle paycheck confirmation ───────────────────────────
      argyle_connections: {
        Row: {
          connection_id: string
          applicant_id: string
          packet_id: string | null
          argyle_user_id: string
          linked_accounts: Json
          linked_at: string
          revoked_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          connection_id?: string
          applicant_id: string
          packet_id?: string | null
          argyle_user_id: string
          linked_accounts?: Json
          linked_at?: string
          revoked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          connection_id?: string
          applicant_id?: string
          packet_id?: string | null
          argyle_user_id?: string
          linked_accounts?: Json
          linked_at?: string
          revoked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_paychecks: {
        Row: {
          marketplace_paycheck_id: string
          applicant_id: string
          packet_id: string | null
          org_id: string | null
          argyle_paycheck_id: string
          employer_name: string
          monthly_amount_usd: number
          projected_benefit_usd: number
          is_cliff_event: boolean
          pay_date: string
          created_at: string
        }
        Insert: {
          marketplace_paycheck_id?: string
          applicant_id: string
          packet_id?: string | null
          org_id?: string | null
          argyle_paycheck_id: string
          employer_name?: string
          monthly_amount_usd: number
          projected_benefit_usd: number
          is_cliff_event?: boolean
          pay_date: string
          created_at?: string
        }
        Update: {
          marketplace_paycheck_id?: string
          applicant_id?: string
          packet_id?: string | null
          org_id?: string | null
          argyle_paycheck_id?: string
          employer_name?: string
          monthly_amount_usd?: number
          projected_benefit_usd?: number
          is_cliff_event?: boolean
          pay_date?: string
          created_at?: string
        }
        Relationships: []
      }
      // ── T-DR3-9: Canvas LMS schedule integration ─────────────────────────
      canvas_connections: {
        Row: {
          connection_id: string
          applicant_id: string
          packet_id: string | null
          access_token_enc: string
          refresh_token_enc: string
          expires_at: string
          canvas_instance_url: string
          connected_at: string
          revoked_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          connection_id?: string
          applicant_id: string
          packet_id?: string | null
          access_token_enc: string
          refresh_token_enc: string
          expires_at: string
          canvas_instance_url: string
          connected_at?: string
          revoked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          connection_id?: string
          applicant_id?: string
          packet_id?: string | null
          access_token_enc?: string
          refresh_token_enc?: string
          expires_at?: string
          canvas_instance_url?: string
          connected_at?: string
          revoked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_staff: {
        Args: never
        Returns: {
          auth_uid: string
          created_at: string
          deleted_at: string | null
          display_name: string
          email: string
          org_id: string
          role_id: string
          staff_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "staff_users"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      gen_uuidv7: { Args: never; Returns: string }
      is_admin_in_org: { Args: { p_org_id: string }; Returns: boolean }
      is_assigned_to_packet: { Args: { p_packet_id: string }; Returns: boolean }
      is_navigator_in_org: { Args: { p_org_id: string }; Returns: boolean }
      redact_pii_json: {
        Args: { p_json: Json; p_schema: string; p_table: string }
        Returns: Json
      }
    }
    Enums: {
      audit_actor_kind:
        | "applicant"
        | "navigator"
        | "admin"
        | "system"
        | "api_key"
      consent_kind: "privacy_notice" | "data_sharing" | "terms_of_service"
      document_kind:
        | "paystub"
        | "photo_id"
        | "lease"
        | "utility_bill"
        | "bank_statement"
        | "tax_return"
        | "benefit_letter"
        | "other"
      handoff_format: "pdf_packet" | "xml_ecs" | "csv_summary" | "json_api"
      launch_state: "CA" | "MA"
      missing_item_status: "pending" | "uploaded" | "resolved" | "waived"
      packet_status:
        | "Draft"
        | "Submitted for Review"
        | "Needs Documents"
        | "Needs Applicant Clarification"
        | "In Navigator Review"
        | "Ready for Handoff"
        | "Handed Off"
        | "Closed"
      staff_role_kind: "navigator" | "supervisor" | "admin" | "auditor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      uat_feedback: {
        Row: {
          id: string
          navigator_email: string
          page_path: string
          message: string
          created_at: string
        }
        Insert: {
          id?: string
          navigator_email: string
          page_path: string
          message: string
          created_at?: string
        }
        Update: {
          id?: string
          navigator_email?: string
          page_path?: string
          message?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  snap_enrollment: {
    Enums: {
      audit_actor_kind: [
        "applicant",
        "navigator",
        "admin",
        "system",
        "api_key",
      ],
      consent_kind: ["privacy_notice", "data_sharing", "terms_of_service"],
      document_kind: [
        "paystub",
        "photo_id",
        "lease",
        "utility_bill",
        "bank_statement",
        "tax_return",
        "benefit_letter",
        "other",
      ],
      handoff_format: ["pdf_packet", "xml_ecs", "csv_summary", "json_api"],
      launch_state: ["CA", "MA"],
      missing_item_status: ["pending", "uploaded", "resolved", "waived"],
      packet_status: [
        "Draft",
        "Submitted for Review",
        "Needs Documents",
        "Needs Applicant Clarification",
        "In Navigator Review",
        "Ready for Handoff",
        "Handed Off",
        "Closed",
      ],
      staff_role_kind: ["navigator", "supervisor", "admin", "auditor"],
    },
  },
} as const
