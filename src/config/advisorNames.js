// src/config/advisorNames.js
// Advisor ID to Name mapping (Phase 4A)

export const ADVISOR_NAMES = {
  '2JKT': 'Scott',
  '2KCC': 'Scott',
  '2KCM': 'Evan',
  '2KDV': 'Evan',
  '2KFY': 'Evan',
  '2KGW': 'Ron',
  '2KYU': 'Evan',
  '70G5': 'Scott',
  '70WB': 'Evan',
  '70YN': 'Evan',
  '70YU': 'Scott',
  '2JTL': 'Jon',
  '2JUU': 'Jack',
  '2PLK': 'Scott',
  '2PN1': 'Scott',
  '2PNG': 'Scott',
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

export function getAdvisorOptions() {
  const advisorGroups = {};
  Object.entries(ADVISOR_NAMES).forEach(([id, name]) => {
    if (!advisorGroups[name]) {
      advisorGroups[name] = [];
    }
    advisorGroups[name].push(id);
  });

  return Object.entries(advisorGroups).map(([name, ids]) => ({
    label: name,
    value: ids[0],
    allIds: ids,
  }));
}

