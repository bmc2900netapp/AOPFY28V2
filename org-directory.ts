// -----------------------------------------------------------------------------
// FY28 AOP Org Directory — canonical reference for Business Leaders (SVPs),
// ESTC Reps, Business Areas, and CIO Staff Engagement Points.
//
// Source of truth: FY28_AOP_Reps.xlsx ("Updated ESTC Matrix" + "ESTC" sheets),
// OCIOTeamSite › IT Portfolio Management › FY'28 AOP. Names, areas and the
// email addresses below are taken verbatim from that workbook. Used to:
//   - offer these important people as suggestions in person-picker fields
//     (owners / VPs / sponsors) so required fields are populated consistently;
//   - auto-fill ESTC Member (= ESTC Rep) and IT Functional Owner (= CIO Staff
//     Engagement Point) when a Business Area is chosen in the intake wizard.
// -----------------------------------------------------------------------------

export interface BusinessArea {
  id: string;             // unique key: `${area} — ${estcRep}`
  area: string;           // e.g. "GTM - Marketing"
  estcRep: string;        // ESTC Rep (maps to the ESTC Member field)
  estcRepEmail: string;   // ESTC Rep email
  businessLeader: string; // SVP / Business Leader for the area
  businessLeaderEmail: string;
  cioStaff: string;       // CIO Staff Engagement Point (maps to IT Functional Owner)
  cioStaffEmail: string;
}

// Canonical name -> email map from FY28_AOP_Reps.xlsx.
export const EMAIL_BY_NAME: Record<string, string> = {
  // Business Leaders (SVPs)
  'Cesar Cernuda': 'Cesar.Cernuda@netapp.com',
  'Wissam Jabre': 'Wissam.Jabre@netapp.com',
  'Syam Nair': 'Syam.Nair@netapp.com',
  "Elizabeth O'Callahan": "Beth.O'Callahan@netapp.com",
  'Gus Shahin': 'Gus@netapp.com',
  // CIO Staff Engagement Points
  'Daniel Lefebvre': 'Daniel.Lefebvre@netapp.com',
  'Srinivas Karedla': 'Srinivas.Karedla@netapp.com',
  'Brian Crawford': 'Brian.Crawford@netapp.com',
  // ESTC Reps
  'Gabie Boko': 'Gabie.Boko@netapp.com',
  'Gabriel Indalecio': 'Gabriel.Indalecio@netapp.com',
  'Srivatsan Vaiyakarnam': 'Srivatsan.Vaiyakarnam@netapp.com',
  'Ashish Dhawan': 'Ashish.Dhawan@netapp.com',
  'Dallas Olson': 'Dallas.Olson@netapp.com',
  'Daniel De Lorenzo': 'Daniel.DeLorenzo@netapp.com',
  'Anthony Nguyen': 'Anthony.Nguyen@netapp.com',
  'Jelena Svircic': 'Jelena.Svircic@netapp.com',
  'Shelly Gupta': 'Shelly.Gupta@netapp.com',
  'Sandeep Singh': 'Sandeep.Singh2@netapp.com',
  'Pravjit Tiwana': 'Pravjit.Tiwana@netapp.com',
  'Ivan Iannaccone': 'Ivan.Iannaccone@netapp.com',
  'Anisha Sivakumar': 'Anisha.Sivakumar@netapp.com',
  'Biren Fondekar': 'Biren.Fondekar@netapp.com',
  'Dena Acevedo': 'Dena.Acevedo@netapp.com',
  'Nicola Acutt': 'Nicola.Acutt@netapp.com',
  'Dorothy Cullen': 'Dorothy.Cullen@netapp.com',
  'Tadhg Bourke': 'Tadhg.Bourke@netapp.com',
  'Gavin Guttersen': 'Gavin.Guttersen@netapp.com',
  'Mike Owens': 'Mike.Owens@netapp.com',
  'Damian Cook': 'Damian.Cook@netapp.com',
  'Hem Nerkar': 'Hem.Nerkar@netapp.com',
  'Tom Fletcher': 'Tom.Fletcher@netapp.com',
  'Mondher Ben Hamida': 'Mondher.BenHamida@netapp.com',
};

function emailFor(name: string): string {
  return EMAIL_BY_NAME[name] ?? '';
}

// Raw groups keyed by Business Leader (SVP) + their CIO Staff Engagement Point.
const GROUPS: { businessLeader: string; cioStaff: string; areas: [string, string][] }[] = [
  {
    businessLeader: 'Cesar Cernuda',
    cioStaff: 'Daniel Lefebvre',
    areas: [
      ['GTM - Marketing', 'Gabie Boko'],
      ['GTM - Sales Operations', 'Gabriel Indalecio'],
      ['GTM - Customer Success', 'Srivatsan Vaiyakarnam'],
      ['GTM - Cloud Sales', 'Ashish Dhawan'],
      ['GTM - Strategy, Revenue, Offers & Enablement', 'Dallas Olson'],
    ],
  },
  {
    businessLeader: 'Wissam Jabre',
    cioStaff: 'Srinivas Karedla',
    areas: [
      ["Finance - Chief Acct'g Officer", 'Daniel De Lorenzo'],
      ['Finance - Corporate FP&A', 'Anthony Nguyen'],
      ['Finance - Reporting and Analytics', 'Jelena Svircic'],
      ['Finance - Business Finance', 'Shelly Gupta'],
    ],
  },
  {
    businessLeader: 'Syam Nair',
    cioStaff: 'Brian Crawford',
    areas: [
      ['Product', 'Sandeep Singh'],
      ['Product', 'Pravjit Tiwana'],
      ['Product - Keystone', 'Ivan Iannaccone'],
      ['Product - Prod Strategy', 'Anisha Sivakumar'],
      ['Product - Customer Experience', 'Biren Fondekar'],
    ],
  },
  {
    businessLeader: "Elizabeth O'Callahan",
    cioStaff: 'Srinivas Karedla',
    areas: [
      ['CAO - Legal', 'Dena Acevedo'],
      ['CAO - Sustainability & Workplace Experience', 'Nicola Acutt'],
      ['CAO - Legal Automation and Technology Lead', 'Dorothy Cullen'],
      ['CAO - HR', 'Tadhg Bourke'],
    ],
  },
  {
    businessLeader: 'Gus Shahin',
    cioStaff: 'Srinivas Karedla',
    areas: [
      ['BTO - Security', 'Gavin Guttersen'],
      ['BTO - Procurement', 'Mike Owens'],
      ['Ops Engineering', 'Damian Cook'],
      ['BTO - CIO', 'Hem Nerkar'],
      ['BTO - Biz Process & Excellence', 'Tom Fletcher'],
      ['BTO - Supply Chain', 'Mondher Ben Hamida'],
    ],
  },
];

export const BUSINESS_AREAS: BusinessArea[] = GROUPS.flatMap((g) =>
  g.areas.map(([area, estcRep]) => ({
    id: `${area} \u2014 ${estcRep}`,
    area,
    estcRep,
    estcRepEmail: emailFor(estcRep),
    businessLeader: g.businessLeader,
    businessLeaderEmail: emailFor(g.businessLeader),
    cioStaff: g.cioStaff,
    cioStaffEmail: emailFor(g.cioStaff),
  })),
);

export function businessAreaById(id: string): BusinessArea | undefined {
  return BUSINESS_AREAS.find((b) => b.id === id);
}

// ---------------------------------------------------------------------------
// People directory (name + email + role) for person-picker suggestions
// ---------------------------------------------------------------------------
export interface DirectoryPerson {
  name: string;
  email: string; // real address from the workbook ('' if unknown)
  role: string;  // short context shown under the name
}

const _people: DirectoryPerson[] = [];
const _seen = new Map<string, DirectoryPerson>();
function addPerson(name: string, role: string) {
  const key = name.trim().toLowerCase();
  if (!key) return;
  if (_seen.has(key)) return; // first role wins (keeps directory compact)
  const p = { name: name.trim(), email: emailFor(name.trim()), role };
  _seen.set(key, p);
  _people.push(p);
}

// Business Leaders (SVPs) first, then ESTC Reps (with their area), then CIO staff.
for (const g of GROUPS) addPerson(g.businessLeader, 'Business Leader (SVP)');
for (const b of BUSINESS_AREAS) addPerson(b.estcRep, `ESTC Rep \u00b7 ${b.area}`);
for (const g of GROUPS) addPerson(g.cioStaff, 'CIO Staff Engagement Point');

export const DIRECTORY_PEOPLE: DirectoryPerson[] = _people;

const _knownNames = new Set(DIRECTORY_PEOPLE.map((p) => p.name.toLowerCase()));
const _knownEmails = new Set(
  DIRECTORY_PEOPLE.filter((p) => p.email).map((p) => p.email.toLowerCase()),
);

/** True if `value` matches a known directory person's name or email (case-insensitive). */
export function isKnownPerson(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = String(value).trim().toLowerCase();
  return _knownNames.has(v) || _knownEmails.has(v);
}

/** Substring search over directory people names and emails (case-insensitive). */
export function findDirectoryPeople(query: string, limit = 6): DirectoryPerson[] {
  const q = (query ?? '').trim().toLowerCase();
  if (q.length < 2) return [];
  const starts: DirectoryPerson[] = [];
  const contains: DirectoryPerson[] = [];
  for (const p of DIRECTORY_PEOPLE) {
    const n = p.name.toLowerCase();
    const e = p.email.toLowerCase();
    if (n.startsWith(q)) starts.push(p);
    else if (n.includes(q) || (e && e.includes(q))) contains.push(p);
  }
  return [...starts, ...contains].slice(0, limit);
}
