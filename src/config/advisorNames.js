// src/config/advisorNames.js
// Advisor ID to Name mapping (Phase 4A)

export const ADVISOR_NAMES = {
  '2JKT': 'Scott',
  '2KCC': 'Scott',
  '2KCM': 'Evan',
  '2KDV': 'Evan',
  '2KFY': 'Evan',
  '2KGW': 'Evan',
  '2KYU': 'Evan',
  '70G5': 'Scott',
  '70WB': 'Evan',
  '70YN': 'Evan',
  '70YU': 'Scott',
  '2JTL': 'Jon',
  '2JUU': 'Jack',
  '2PLK': 'Scott',
  '2PN1': 'Scott',
  '2PNG': 'Evan',
  '70UG': 'Jack',
  '70UU': 'Jack',
  '71PD': 'Scott',
};

export function getAdvisorName(advisorId) {
  return ADVISOR_NAMES[advisorId] || advisorId;
}

export function getUniqueAdvisors() {
  const unique = new Set(Object.values(ADVISOR_NAMES));
  return Array.from(unique).sort();
}

export function getAdvisorsByName(name) {
  return Object.entries(ADVISOR_NAMES)
    .filter(([id, advisorName]) => advisorName === name)
    .map(([id]) => id);
}

// Team groupings
export const TEAMS = {
  'Team Jon': ['Jon', 'Jack'],
  'Team Scott': ['Scott', 'Evan']
};

export function getAdvisorOptions() {
  const advisorGroups = {};
  Object.entries(ADVISOR_NAMES).forEach(([id, name]) => {
    if (!advisorGroups[name]) advisorGroups[name] = [];
    advisorGroups[name].push(id);
  });

  // Build team options first
  const options = [];
  Object.entries(TEAMS).forEach(([teamName, members]) => {
    const ids = members.flatMap((m) => advisorGroups[m] || []);
    options.push({ label: teamName, value: teamName, allIds: ids, kind: 'team' });
  });
  // Separator
  options.push({ label: '—', value: '__sep__', disabled: true });
  // Individual advisors
  Object.entries(advisorGroups)
    .sort((a,b) => a[0].localeCompare(b[0]))
    .forEach(([name, ids]) => {
      options.push({ label: name, value: name, allIds: ids, kind: 'advisor' });
    });
  return options;
}

export function getAllAdvisorIdsForName(name) {
  // Accept team names
  if (TEAMS[name]) {
    const members = TEAMS[name] || [];
    return members.flatMap((m) => getAdvisorsByName(m));
  }
  return Object.entries(ADVISOR_NAMES)
    .filter(([id, advisorName]) => advisorName === name)
    .map(([id]) => id);
}

