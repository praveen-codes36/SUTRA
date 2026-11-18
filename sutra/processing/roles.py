"""Institutional role mapping for academic/administrative email addresses."""

from typing import Dict, Optional

# Canonical role directory derived from the institution schema
INSTITUTIONAL_ROLES: Dict[str, str] = {
    "dean.admin@northbridge.edu": "Dean (Administration)",
    "dean.student@northbridge.edu": "Dean (Student Affairs)",
    "dean.research@northbridge.edu": "Dean (Research)",
    "registrar@northbridge.edu": "Registrar",
    "mech.hod@northbridge.edu": "Head of Department",
    "purchase@northbridge.edu": "Purchase Section",
    "accounts@northbridge.edu": "Accounts Section",
    "admin.officer@northbridge.edu": "Administrative Officer",
    "office.superintendent@northbridge.edu": "Office Superintendent",
    "facilities@northbridge.edu": "Facilities Office",
    "security@northbridge.edu": "Security Office",
    "maintenance@northbridge.edu": "Maintenance Section",
    "exam.cell@northbridge.edu": "Examination Cell",
    "research.office@northbridge.edu": "Research Office",
    "it.network@northbridge.edu": "IT Network Team",
    "it.helpdesk@northbridge.edu": "IT Helpdesk",
    "it.support@northbridge.edu": "IT Support",
    "student.affairs@northbridge.edu": "Student Affairs",
    "department.office@northbridge.edu": "Department Office",
    "fest.secretary@northbridge.edu": "Fest Secretary",
    "lab.coordinator@northbridge.edu": "Lab Coordinator",
    "lab.engineer@northbridge.edu": "Lab Engineer",
    "seminar.coordinator@northbridge.edu": "Seminar Coordinator",
    "faculty.member@northbridge.edu": "Faculty Member",
    "mech.faculty@northbridge.edu": "Mechanical Faculty",
    "mech.exam.coordinator@northbridge.edu": "Mechanical Exam Coordinator",
    "pi.lab@northbridge.edu": "Principal Investigator",
}

def resolve_role(email_address: str) -> str:
    """Resolve an email address to a human-readable institutional title."""
    addr = email_address.strip().lower()
    if addr in INSTITUTIONAL_ROLES:
        return INSTITUTIONAL_ROLES[addr]
    # Fallback to local part formatted nicely
    local_part = addr.split("@")[0].replace(".", " ").title()
    return local_part

