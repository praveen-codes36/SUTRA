"""Identity Directory and Role Resolution Engine (PRD §5.3, §10.5, Appendix B, N-18).

Represents the PRD Appendix B Demo Identity Directory (30 institutional addresses)
with explicit vs inferred attribution, shared mailbox detection, and role normalization.
"""

from __future__ import annotations
from enum import Enum
from typing import Dict, Optional, NamedTuple
from pydantic import BaseModel, Field


class IdentityType(str, Enum):
    ROLE = "Role"
    PERSON_ROLE = "Person/role"
    SHARED_MAILBOX = "Shared mailbox"
    GROUP = "Group"
    UNKNOWN = "Unknown"


class RoleSource(str, Enum):
    DIRECTORY = "DIRECTORY"
    INFERRED_FROM_ADDRESS = "INFERRED_FROM_ADDRESS"
    NOT_STATED = "NOT_STATED"


class IdentityEntry(BaseModel):
    """PRD Appendix B & §10.5 directory entry."""
    address: str
    role_label: str
    identity_type: IdentityType
    department: Optional[str] = None
    role_source: RoleSource = RoleSource.INFERRED_FROM_ADDRESS
    confidence: float = 1.0
    is_shared_mailbox: bool = False


# Canonical Appendix B Demo Identity Directory (30 institutional addresses)
# Note: Per PRD D-04 & Appendix B, all entries carry source = INFERRED_FROM_ADDRESS
# until an institutional administrator explicitly confirms them.
DEMO_IDENTITY_DIRECTORY: Dict[str, Dict[str, Any]] = {
    "accounts@northbridge.edu": {
        "role_label": "Accounts Section",
        "type": IdentityType.SHARED_MAILBOX,
        "dept": "Finance",
        "is_shared": True,
    },
    "admin.officer@northbridge.edu": {
        "role_label": "Administrative Officer",
        "type": IdentityType.PERSON_ROLE,
        "dept": "Administration",
        "is_shared": False,
    },
    "class.representatives@northbridge.edu": {
        "role_label": "Class Representatives",
        "type": IdentityType.GROUP,
        "dept": "Student Affairs",
        "is_shared": True,
    },
    "dean.admin@northbridge.edu": {
        "role_label": "Dean (Administration)",
        "type": IdentityType.ROLE,
        "dept": "Administration",
        "is_shared": False,
    },
    "dean.research@northbridge.edu": {
        "role_label": "Dean (Research)",
        "type": IdentityType.ROLE,
        "dept": "Research",
        "is_shared": False,
    },
    "dean.student@northbridge.edu": {
        "role_label": "Dean (Student Affairs)",
        "type": IdentityType.ROLE,
        "dept": "Student Affairs",
        "is_shared": False,
    },
    "department.office@northbridge.edu": {
        "role_label": "Department Office",
        "type": IdentityType.SHARED_MAILBOX,
        "dept": "Mechanical Engineering",
        "is_shared": True,
    },
    "exam.cell@northbridge.edu": {
        "role_label": "Examination Cell",
        "type": IdentityType.SHARED_MAILBOX,
        "dept": "Academics",
        "is_shared": True,
    },
    "facilities@northbridge.edu": {
        "role_label": "Facilities Office",
        "type": IdentityType.SHARED_MAILBOX,
        "dept": "Estate & Facilities",
        "is_shared": True,
    },
    "faculty.coordinators@northbridge.edu": {
        "role_label": "Faculty Coordinators",
        "type": IdentityType.GROUP,
        "dept": "Academics",
        "is_shared": True,
    },
    "faculty.member@northbridge.edu": {
        "role_label": "Faculty Member",
        "type": IdentityType.PERSON_ROLE,
        "dept": "Mechanical Engineering",
        "is_shared": False,
    },
    "fest.secretary@northbridge.edu": {
        "role_label": "Fest Secretary",
        "type": IdentityType.ROLE,
        "dept": "Student Affairs",
        "is_shared": False,
    },
    "it.helpdesk@northbridge.edu": {
        "role_label": "IT Helpdesk",
        "type": IdentityType.SHARED_MAILBOX,
        "dept": "Information Technology",
        "is_shared": True,
    },
    "it.network@northbridge.edu": {
        "role_label": "IT Network Team",
        "type": IdentityType.SHARED_MAILBOX,
        "dept": "Information Technology",
        "is_shared": True,
    },
    "it.support@northbridge.edu": {
        "role_label": "IT Support",
        "type": IdentityType.SHARED_MAILBOX,
        "dept": "Information Technology",
        "is_shared": True,
    },
    "lab.coordinator@northbridge.edu": {
        "role_label": "Lab Coordinator (technical committee finding, E003)",
        "type": IdentityType.ROLE,
        "dept": "Mechanical Engineering",
        "is_shared": False,
    },
    "lab.engineer@northbridge.edu": {
        "role_label": "Lab Engineer, Materials Testing Lab",
        "type": IdentityType.ROLE,
        "dept": "Mechanical Engineering",
        "is_shared": False,
    },
    "maintenance@northbridge.edu": {
        "role_label": "Maintenance Section",
        "type": IdentityType.SHARED_MAILBOX,
        "dept": "Estate & Facilities",
        "is_shared": True,
    },
    "mech.exam.coordinator@northbridge.edu": {
        "role_label": "Mechanical Exam Coordinator",
        "type": IdentityType.ROLE,
        "dept": "Mechanical Engineering",
        "is_shared": False,
    },
    "mech.faculty@northbridge.edu": {
        "role_label": "Mechanical Faculty",
        "type": IdentityType.GROUP,
        "dept": "Mechanical Engineering",
        "is_shared": True,
    },
    "mech.hod@northbridge.edu": {
        "role_label": "Head of Department (Mechanical)",
        "type": IdentityType.ROLE,
        "dept": "Mechanical Engineering",
        "is_shared": False,
    },
    "office.superintendent@northbridge.edu": {
        "role_label": "Office Superintendent",
        "type": IdentityType.ROLE,
        "dept": "Administration",
        "is_shared": False,
    },
    "pi.lab@northbridge.edu": {
        "role_label": "Principal Investigator (Lab)",
        "type": IdentityType.ROLE,
        "dept": "Research",
        "is_shared": False,
    },
    "purchase@northbridge.edu": {
        "role_label": "Purchase Section",
        "type": IdentityType.SHARED_MAILBOX,
        "dept": "Administration",
        "is_shared": True,
    },
    "registrar@northbridge.edu": {
        "role_label": "Registrar",
        "type": IdentityType.ROLE,
        "dept": "Administration",
        "is_shared": False,
    },
    "research.office@northbridge.edu": {
        "role_label": "Research Office",
        "type": IdentityType.SHARED_MAILBOX,
        "dept": "Research",
        "is_shared": True,
    },
    "security@northbridge.edu": {
        "role_label": "Security Office",
        "type": IdentityType.SHARED_MAILBOX,
        "dept": "Administration",
        "is_shared": True,
    },
    "seminar.coordinator@northbridge.edu": {
        "role_label": "Seminar Coordinator",
        "type": IdentityType.ROLE,
        "dept": "Mechanical Engineering",
        "is_shared": False,
    },
    "seminar.support@northbridge.edu": {
        "role_label": "Seminar Support",
        "type": IdentityType.SHARED_MAILBOX,
        "dept": "Estate & Facilities",
        "is_shared": True,
    },
    "student.affairs@northbridge.edu": {
        "role_label": "Student Affairs",
        "type": IdentityType.SHARED_MAILBOX,
        "dept": "Student Affairs",
        "is_shared": True,
    },
}


class IdentityResolver:
    """Resolves institutional email addresses and name aliases to structured directory entries."""

    @staticmethod
    def resolve(address: str) -> IdentityEntry:
        """
        Resolve address to full IdentityEntry.
        If address exists in directory -> returns Directory entry with INFERRED_FROM_ADDRESS flag.
        If address is unknown -> derives human-readable title and marks UNKNOWN.
        """
        clean_addr = (address or "").strip().lower()
        if not clean_addr:
            return IdentityEntry(
                address="",
                role_label="Not Stated",
                identity_type=IdentityType.UNKNOWN,
                role_source=RoleSource.NOT_STATED,
                confidence=0.0,
            )

        if clean_addr in DEMO_IDENTITY_DIRECTORY:
            info = DEMO_IDENTITY_DIRECTORY[clean_addr]
            return IdentityEntry(
                address=clean_addr,
                role_label=info["role_label"],
                identity_type=info["type"],
                department=info.get("dept"),
                role_source=RoleSource.INFERRED_FROM_ADDRESS,
                confidence=0.95,
                is_shared_mailbox=info.get("is_shared", False),
            )

        # Fallback to local part formatting
        local_part = clean_addr.split("@")[0].replace(".", " ").title()
        return IdentityEntry(
            address=clean_addr,
            role_label=local_part,
            identity_type=IdentityType.UNKNOWN,
            role_source=RoleSource.INFERRED_FROM_ADDRESS,
            confidence=0.5,
            is_shared_mailbox=False,
        )

    @staticmethod
    def get_role_label(address: str) -> str:
        """Convenience method returning the human-readable institutional title."""
        return IdentityResolver.resolve(address).role_label
