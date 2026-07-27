// Bag tag packing — mirrors server/src/config/constants.js (CONTAINER_CAPACITY,
// SNACK_BITES_PER_CONTAINER). One sample meal is one container; ten snack bites make one
// container. Each bag holds up to CONTAINER_CAPACITY containers.
export const CONTAINER_CAPACITY = 15;
export const SNACK_BITES_PER_CONTAINER = 10;

// Splits an event's meals/snack-bites into bags, greedily filling each bag to capacity
// (meals first, then snack-bite containers) before starting the next one, so every bag's
// contents reflect exactly what physically goes in it.
export function computeBags(samplesNeeded, snackBitesNeeded) {
  let remainingMeals = samplesNeeded || 0;
  let remainingSnackContainers = Math.round((snackBitesNeeded || 0) / SNACK_BITES_PER_CONTAINER);
  const bags = [];

  while (remainingMeals > 0 || remainingSnackContainers > 0) {
    let capacity = CONTAINER_CAPACITY;
    const mealsInBag = Math.min(remainingMeals, capacity);
    capacity -= mealsInBag;
    const snackContainersInBag = Math.min(remainingSnackContainers, capacity);

    bags.push({ meals: mealsInBag, snackBites: snackContainersInBag * SNACK_BITES_PER_CONTAINER });
    remainingMeals -= mealsInBag;
    remainingSnackContainers -= snackContainersInBag;
  }

  return bags;
}

export function totalContainers(samplesNeeded, snackBitesNeeded) {
  return (samplesNeeded || 0) + Math.round((snackBitesNeeded || 0) / SNACK_BITES_PER_CONTAINER);
}
