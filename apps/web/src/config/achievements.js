export const ACHIEVEMENTS = [
  {
    id: 'reset_confirmed',
    type: 'total_resets',
    threshold: 3,
    title: 'Are you sure about that?',
    description: 'Full run resets. Double-check before you smash that button next time.',
    image: '/assets/achievements/areyousureaboutthat.gif',
  },
  {
    id: 'obeerma',
    type: 'run_drinks',
    variationType: 'beer',
    // Threshold counts beers in the current run (drinkVariations.beer). Unlocks on the 10th beer of a run.
    threshold: 10,
    title: 'Obeerma',
    description: 'Beers down the hatch. Change is brewing.',
    image: '/assets/achievements/obeerma.png',
  },
  {
    id: 'full_bender',
    type: 'run_drinks',
    threshold: 20,
    title: 'Full Bender',
    description: 'Twenty drinks. Maybe switch to water for one round?',
    image: '/assets/achievements/fullbender.gif',
  },
  {
    id: 'like_fine_wine',
    type: 'total_drinks',
    variationType: 'wine',
    threshold: 5,
    title: 'Like Fine Wine',
    description: 'Five wines deep and still aging gracefully.',
    image: '/assets/achievements/likefinewine.png',
  },
  {
    id: 'top_donor',
    type: 'manual',
    title: 'Top Donor',
    description: 'Du har doneret til Sladesh App, mange tak for dit bidrag',
    image: '/assets/achievements/topdonor.jpeg',
  },
]
