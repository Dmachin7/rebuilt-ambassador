// Bag tag packing — mirrors server/src/config/constants.js (CONTAINER_CAPACITY,
// SNACK_BITES_PER_CONTAINER). One sample meal is one container; ten snack bites make one
// container. Each bag holds up to CONTAINER_CAPACITY containers.
export const CONTAINER_CAPACITY = 15;
export const SNACK_BITES_PER_CONTAINER = 10;

// Splits an event's meals/breakfasts/snack-bites into bags, greedily filling each bag to
// capacity (meals, then breakfasts, then snack-bite containers) before starting the next one,
// so every bag's contents reflect exactly what physically goes in it. A sample breakfast takes
// one container, same as a sample meal.
export function computeBags(samplesNeeded, breakfastsNeeded, snackBitesNeeded) {
  let remainingMeals = samplesNeeded || 0;
  let remainingBreakfasts = breakfastsNeeded || 0;
  let remainingSnackContainers = Math.round((snackBitesNeeded || 0) / SNACK_BITES_PER_CONTAINER);
  const bags = [];

  while (remainingMeals > 0 || remainingBreakfasts > 0 || remainingSnackContainers > 0) {
    let capacity = CONTAINER_CAPACITY;
    const mealsInBag = Math.min(remainingMeals, capacity);
    capacity -= mealsInBag;
    const breakfastsInBag = Math.min(remainingBreakfasts, capacity);
    capacity -= breakfastsInBag;
    const snackContainersInBag = Math.min(remainingSnackContainers, capacity);

    bags.push({
      meals: mealsInBag,
      breakfasts: breakfastsInBag,
      snackBites: snackContainersInBag * SNACK_BITES_PER_CONTAINER,
    });
    remainingMeals -= mealsInBag;
    remainingBreakfasts -= breakfastsInBag;
    remainingSnackContainers -= snackContainersInBag;
  }

  return bags;
}

export function totalContainers(samplesNeeded, breakfastsNeeded, snackBitesNeeded) {
  return (samplesNeeded || 0) + (breakfastsNeeded || 0) + Math.round((snackBitesNeeded || 0) / SNACK_BITES_PER_CONTAINER);
}
