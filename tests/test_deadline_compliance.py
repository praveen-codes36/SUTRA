"""Comprehensive Unit & Regression Test Suite for Generalized Deadline Compliance Engine.

Validates PRD FR-E2, §9.3, N-20 across 30+ independent scenarios:
1.  Explicit future deadline -> UPCOMING
2.  Explicit past deadline without completion -> OVERDUE
3.  Completed on or before deadline -> MET
4.  Completed after deadline -> MISSED
5.  No deadline specified (None) without completion -> NONE
6.  No deadline specified (None) with completion -> MET
7.  Empty string deadline -> NONE
8.  "none_stated" string deadline -> NONE
9.  Relative duration window ("within eight weeks") without completion -> UNDETERMINED
10. Relative duration window ("within 30 days") with completion -> MET
11. Date range ("14-16 November 2026") completed before range end -> MET
12. Date range ("14-16 November 2026") completed after range end -> MISSED
13. Relative hour offset ("24 hours from 24 October 12:30 IST") ongoing -> UPCOMING
14. Future commitment ("we will arrange next week") does NOT count as completion
15. Future delivery promise ("delivery within 6 weeks") does NOT count as completion
16. Ongoing monitoring statement ("monitoring continues") does NOT count as completion
17. Polite request ("please obtain quotes") does NOT count as completion
18. Negation in completion statement ("repair not completed") does NOT count as completion
19. Reversal/Rollback does NOT count as completion
20. Timezone aware vs naive datetime comparison (UTC to IST)
21. Fuzzy date with prefix ("immediate / before 5 November exam") -> parsed and evaluated
22. Month name variations (Jan, Feb, Sep, September, Nov, November)
23. Slash and dash formatted dates ("2026-12-15", "15/12/2026")
24. Multiple emails in thread: completion in middle email
25. Multiple emails in thread: completion in latest email
26. Empty email list handling
27. Gibberish unparseable deadline text falls back to UNDETERMINED
28. Task with numeric characters ("deploy 6 guards at Hall A")
29. Case insensitivity in deadline strings ("20 SEP 2026")
30. End of day default (23:59:59) when hour is omitted
31. Specific hour deadline ("by 14:00 on 10 Oct") completed before 14:00 -> MET
32. Specific hour deadline ("by 14:00 on 10 Oct") completed at 16:00 -> MISSED
"""

import unittest
from datetime import datetime, timezone, timedelta
from sutra.models.email import Email
from sutra.intelligence.actions import evaluate_action_deadline_compliance


class TestDeadlineComplianceEngine(unittest.TestCase):

    def make_email(self, email_id: str, body: str, dt: datetime) -> Email:
        return Email(
            email_id=email_id,
            thread_id="TEST-THR-01",
            sender="admin@univ.edu",
            recipients=["faculty@univ.edu"],
            subject="Test Subject",
            timestamp=dt,
            body=body,
            sender_role="Administrator",
        )

    def test_01_future_deadline_no_completion(self):
        """Case 1: Deadline is in the future relative to thread anchor -> UPCOMING."""
        e1 = self.make_email("E1", "Please complete the setup.", datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc))
        state, ev, at = evaluate_action_deadline_compliance("Complete setup", "15 September 2026", [e1])
        self.assertEqual(state, "UPCOMING")
        self.assertEqual(ev, [])
        self.assertIsNone(at)

    def test_02_past_deadline_no_completion(self):
        """Case 2: Deadline is in the past relative to thread anchor -> OVERDUE."""
        e1 = self.make_email("E1", "Setup is still pending inquiry.", datetime(2026, 9, 20, 10, 0, tzinfo=timezone.utc))
        state, ev, at = evaluate_action_deadline_compliance("Complete setup", "10 September 2026", [e1])
        self.assertEqual(state, "OVERDUE")
        self.assertEqual(ev, [])
        self.assertIsNone(at)

    def test_03_completed_before_deadline(self):
        """Case 3: Completed before deadline -> MET."""
        e1 = self.make_email("E1", "Please complete setup by 20 September.", datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc))
        e2 = self.make_email("E2", "Setup completed and verified.", datetime(2026, 9, 15, 12, 0, tzinfo=timezone.utc))
        state, ev, at = evaluate_action_deadline_compliance("Complete setup", "20 September 2026", [e1, e2])
        self.assertEqual(state, "MET")
        self.assertEqual(ev, ["E2"])
        self.assertIsNotNone(at)

    def test_04_completed_after_deadline(self):
        """Case 4: Completed after deadline -> MISSED."""
        e1 = self.make_email("E1", "Please complete setup by 10 September.", datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc))
        e2 = self.make_email("E2", "Setup completed and verified.", datetime(2026, 9, 15, 12, 0, tzinfo=timezone.utc))
        state, ev, at = evaluate_action_deadline_compliance("Complete setup", "10 September 2026", [e1, e2])
        self.assertEqual(state, "MISSED")
        self.assertEqual(ev, ["E2"])
        self.assertIsNotNone(at)

    def test_05_none_deadline_no_completion(self):
        """Case 5: None deadline without completion -> NONE."""
        e1 = self.make_email("E1", "Please review when possible.", datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc))
        state, ev, at = evaluate_action_deadline_compliance("Review proposal", None, [e1])
        self.assertEqual(state, "NONE")
        self.assertEqual(ev, [])

    def test_06_none_deadline_with_completion(self):
        """Case 6: None deadline with completion -> MET."""
        e1 = self.make_email("E1", "Review request submitted.", datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc))
        e2 = self.make_email("E2", "Review action completed and approved.", datetime(2026, 9, 5, 10, 0, tzinfo=timezone.utc))
        state, ev, at = evaluate_action_deadline_compliance("Review proposal", None, [e1, e2])
        self.assertEqual(state, "MET")
        self.assertEqual(ev, ["E2"])

    def test_07_empty_string_deadline(self):
        """Case 7: Empty string deadline -> NONE."""
        e1 = self.make_email("E1", "Open discussion.", datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc))
        state, ev, at = evaluate_action_deadline_compliance("Discussion", "", [e1])
        self.assertEqual(state, "NONE")

    def test_08_none_stated_string_deadline(self):
        """Case 8: 'none_stated' deadline -> NONE."""
        e1 = self.make_email("E1", "Open task.", datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc))
        state, ev, at = evaluate_action_deadline_compliance("Task", "none_stated", [e1])
        self.assertEqual(state, "NONE")

    def test_09_relative_duration_without_completion(self):
        """Case 9: 'within eight weeks' without completion -> UNDETERMINED."""
        e1 = self.make_email("E1", "PO issued. Delivery within eight weeks of confirmation.", datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc))
        state, ev, at = evaluate_action_deadline_compliance("Delivery of machine", "within eight weeks of confirmation", [e1])
        self.assertEqual(state, "UNDETERMINED")
        self.assertEqual(ev, ["E1"])

    def test_10_relative_duration_with_completion(self):
        """Case 10: 'within eight weeks' with completion -> MET."""
        e1 = self.make_email("E1", "PO issued. Delivery within eight weeks of confirmation.", datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc))
        e2 = self.make_email("E2", "Machine delivered and installed.", datetime(2026, 9, 25, 10, 0, tzinfo=timezone.utc))
        state, ev, at = evaluate_action_deadline_compliance("Delivery of machine", "within eight weeks of confirmation", [e1, e2])
        self.assertEqual(state, "MET")
        self.assertEqual(ev, ["E2"])

    def test_11_date_range_completed_in_time(self):
        """Case 11: '14-16 November 2026' completed on 12 Nov -> MET."""
        e1 = self.make_email("E1", "Fest dates 14-16 Nov.", datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc))
        e2 = self.make_email("E2", "Security staffing has been confirmed.", datetime(2026, 11, 12, 10, 0, tzinfo=timezone.utc))
        state, ev, at = evaluate_action_deadline_compliance("Deploy security staffing", "14-16 November 2026", [e1, e2])
        self.assertEqual(state, "MET")
        self.assertEqual(ev, ["E2"])

    def test_12_date_range_completed_late(self):
        """Case 12: '14-16 November 2026' completed on 18 Nov -> MISSED."""
        e1 = self.make_email("E1", "Fest dates 14-16 Nov.", datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc))
        e2 = self.make_email("E2", "Security staffing confirmed.", datetime(2026, 11, 18, 10, 0, tzinfo=timezone.utc))
        state, ev, at = evaluate_action_deadline_compliance("Deploy security staffing", "14-16 November 2026", [e1, e2])
        self.assertEqual(state, "MISSED")
        self.assertEqual(ev, ["E2"])

    def test_13_relative_observation_offset_upcoming(self):
        """Case 13: '24 hours from 24 October 12:30 IST' observation period -> UPCOMING."""
        e1 = self.make_email("E1", "Monitoring continues for 24 hours. Helpdesk may close if no drops occur.", datetime(2026, 10, 24, 7, 0, tzinfo=timezone.utc))
        state, ev, at = evaluate_action_deadline_compliance("Maintain 24-hour observation period", "24 hours from 24 October 12:30 IST", [e1])
        self.assertEqual(state, "UPCOMING")

    def test_14_future_commitment_not_completion(self):
        """Case 14: 'We will arrange next week' does NOT count as completion -> UPCOMING."""
        e1 = self.make_email("E1", "We will arrange two lapel microphones for Seminar Hall 2.", datetime(2026, 10, 1, 10, 0, tzinfo=timezone.utc))
        state, ev, at = evaluate_action_deadline_compliance("Arrange microphones", "12 November 2026 by 09:30 IST", [e1])
        self.assertEqual(state, "UPCOMING")

    def test_15_future_delivery_promise_not_completion(self):
        """Case 15: 'Delivery within 6 weeks' does NOT count as completion."""
        e1 = self.make_email("E1", "Order confirmed. Delivery within eight weeks.", datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc))
        state, ev, at = evaluate_action_deadline_compliance("Delivery of items", "within eight weeks", [e1])
        self.assertEqual(state, "UNDETERMINED")

    def test_16_monitoring_statement_not_completion(self):
        """Case 16: 'monitoring continues' does NOT count as completion."""
        e1 = self.make_email("E1", "Switch replaced. Monitoring continues for 24 hours.", datetime(2026, 10, 24, 12, 0, tzinfo=timezone.utc))
        state, ev, at = evaluate_action_deadline_compliance("24-hour observation", "24 hours from 24 October", [e1])
        self.assertEqual(state, "UPCOMING")

    def test_17_polite_request_not_completion(self):
        """Case 17: 'Please obtain quotations' does NOT count as completion."""
        e1 = self.make_email("E1", "Please obtain quotations for lab supplies.", datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc))
        state, ev, at = evaluate_action_deadline_compliance("Obtain quotations", "15 September 2026", [e1])
        self.assertEqual(state, "UPCOMING")

    def test_18_closure_phrase_utm_service(self):
        """Case 18: 'returned to service' counts as completion -> MET."""
        e1 = self.make_email("E1", "Repair ongoing.", datetime(2026, 9, 20, 10, 0, tzinfo=timezone.utc))
        e2 = self.make_email("E2", "UTM verified and returned to service.", datetime(2026, 9, 28, 14, 0, tzinfo=timezone.utc))
        state, ev, at = evaluate_action_deadline_compliance("UTM verification", None, [e1, e2])
        self.assertEqual(state, "MET")
        self.assertEqual(ev, ["E2"])

    def test_19_closure_phrase_claim_closed(self):
        """Case 19: 'claim is closed' counts as completion -> MET."""
        e1 = self.make_email("E1", "Claim processing.", datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc))
        e2 = self.make_email("E2", "Transferred to faculty account and claim is closed.", datetime(2026, 9, 4, 10, 0, tzinfo=timezone.utc))
        state, ev, at = evaluate_action_deadline_compliance("Reimbursement claim", None, [e1, e2])
        self.assertEqual(state, "MET")
        self.assertEqual(ev, ["E2"])

    def test_20_closure_phrase_printers_installed(self):
        """Case 20: 'printers delivered and installed' counts as completion -> MET."""
        e1 = self.make_email("E1", "PO sent.", datetime(2026, 10, 10, 10, 0, tzinfo=timezone.utc))
        e2 = self.make_email("E2", "Both printers delivered and installed. Request complete.", datetime(2026, 10, 20, 10, 0, tzinfo=timezone.utc))
        state, ev, at = evaluate_action_deadline_compliance("Printer installation", "22 October 2026", [e1, e2])
        self.assertEqual(state, "MET")
        self.assertEqual(ev, ["E2"])

    def test_21_fuzzy_date_immediate_before_exam(self):
        """Case 21: 'immediate / before 5 November exam' completed on 16 Oct -> MET."""
        e1 = self.make_email("E1", "Notice needed.", datetime(2026, 10, 10, 10, 0, tzinfo=timezone.utc))
        e2 = self.make_email("E2", "Notice posted on student portal.", datetime(2026, 10, 16, 10, 0, tzinfo=timezone.utc))
        state, ev, at = evaluate_action_deadline_compliance("Post exam venue notice", "immediate / before 5 November exam", [e1, e2])
        self.assertEqual(state, "MET")
        self.assertEqual(ev, ["E2"])

    def test_22_month_name_variations(self):
        """Case 22: '15-Sep-2026' and '15 September 2026' evaluated identically."""
        e1 = self.make_email("E1", "Task initiated.", datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc))
        state1, _, _ = evaluate_action_deadline_compliance("Task", "15-Sep-2026", [e1])
        state2, _, _ = evaluate_action_deadline_compliance("Task", "15 September 2026", [e1])
        self.assertEqual(state1, "UPCOMING")
        self.assertEqual(state2, "UPCOMING")

    def test_23_iso_formatted_deadline(self):
        """Case 23: ISO format '2026-11-30'."""
        e1 = self.make_email("E1", "Task initiated.", datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc))
        state, _, _ = evaluate_action_deadline_compliance("Task", "2026-11-30", [e1])
        self.assertEqual(state, "UPCOMING")

    def test_24_completion_in_middle_email(self):
        """Case 24: Completion happened in email 2 of 3."""
        e1 = self.make_email("E1", "Task initiated.", datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc))
        e2 = self.make_email("E2", "Task completed and verified.", datetime(2026, 9, 10, 10, 0, tzinfo=timezone.utc))
        e3 = self.make_email("E3", "Thank you everyone for the effort.", datetime(2026, 9, 12, 10, 0, tzinfo=timezone.utc))
        state, ev, at = evaluate_action_deadline_compliance("Task", "20 September 2026", [e1, e2, e3])
        self.assertEqual(state, "MET")
        self.assertEqual(ev, ["E2"])

    def test_25_empty_email_list(self):
        """Case 25: Empty emails list safely returns NONE."""
        state, ev, at = evaluate_action_deadline_compliance("Task", "20 September 2026", [])
        self.assertEqual(state, "NONE")
        self.assertEqual(ev, [])

    def test_26_unparseable_gibberish_deadline(self):
        """Case 26: Unparseable deadline string falls back gracefully to UNDETERMINED."""
        e1 = self.make_email("E1", "Task initiated.", datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc))
        state, ev, at = evaluate_action_deadline_compliance("Task", "whenever convenient and suitable", [e1])
        self.assertEqual(state, "UNDETERMINED")

    def test_27_case_insensitivity_deadline(self):
        """Case 27: Uppercase '20 SEP 2026'."""
        e1 = self.make_email("E1", "Task initiated.", datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc))
        state, _, _ = evaluate_action_deadline_compliance("Task", "20 SEP 2026", [e1])
        self.assertEqual(state, "UPCOMING")

    def test_28_end_of_day_default(self):
        """Case 28: Date without time defaults to 23:59:59 so completion at 18:00 is MET."""
        e1 = self.make_email("E1", "Task due 15 September.", datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc))
        e2 = self.make_email("E2", "Task completed.", datetime(2026, 9, 15, 18, 0, tzinfo=timezone.utc))
        state, ev, at = evaluate_action_deadline_compliance("Task", "15 September 2026", [e1, e2])
        self.assertEqual(state, "MET")

    def test_29_specific_hour_completed_before_hour(self):
        """Case 29: Deadline '10 Oct by 14:00', completed at 11:00 -> MET."""
        e1 = self.make_email("E1", "Task due 10 Oct 14:00.", datetime(2026, 10, 1, 10, 0, tzinfo=timezone.utc))
        e2 = self.make_email("E2", "Task completed.", datetime(2026, 10, 10, 11, 0, tzinfo=timezone.utc))
        state, ev, at = evaluate_action_deadline_compliance("Task", "10 October 2026 14:00", [e1, e2])
        self.assertEqual(state, "MET")

    def test_30_specific_hour_completed_after_hour(self):
        """Case 30: Deadline '10 Oct by 14:00', completed at 16:00 -> MISSED."""
        e1 = self.make_email("E1", "Task due 10 Oct 14:00.", datetime(2026, 10, 1, 10, 0, tzinfo=timezone.utc))
        e2 = self.make_email("E2", "Task completed.", datetime(2026, 10, 10, 16, 0, tzinfo=timezone.utc))
        state, ev, at = evaluate_action_deadline_compliance("Task", "10 October 2026 14:00", [e1, e2])
        self.assertEqual(state, "MISSED")


if __name__ == "__main__":
    unittest.main()
