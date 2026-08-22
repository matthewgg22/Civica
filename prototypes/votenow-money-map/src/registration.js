// Ballpark registered-voter counts by state (~2024, in whole voters).
// Public, approximate — good enough to normalize the money map. The production
// version pulls these from state voter-registration files / the U.S. EAC EAVS /
// Census CPS. North Dakota has no voter registration; value is eligible-adult
// approx so the denominator still works.
export const REGISTERED = {
  Alabama: 3_600_000, Alaska: 610_000, Arizona: 4_300_000, Arkansas: 1_800_000,
  California: 22_000_000, Colorado: 3_900_000, Connecticut: 2_400_000, Delaware: 750_000,
  Florida: 14_000_000, Georgia: 8_000_000, Hawaii: 850_000, Idaho: 1_000_000,
  Illinois: 8_100_000, Indiana: 4_800_000, Iowa: 2_200_000, Kansas: 1_900_000,
  Kentucky: 3_400_000, Louisiana: 3_000_000, Maine: 1_100_000, Maryland: 4_200_000,
  Massachusetts: 4_900_000, Michigan: 8_100_000, Minnesota: 3_600_000, Mississippi: 1_900_000,
  Missouri: 4_300_000, Montana: 750_000, Nebraska: 1_200_000, Nevada: 2_000_000,
  "New Hampshire": 1_000_000, "New Jersey": 6_500_000, "New Mexico": 1_300_000, "New York": 12_500_000,
  "North Carolina": 7_700_000, "North Dakota": 600_000, Ohio: 8_000_000, Oklahoma: 2_300_000,
  Oregon: 3_000_000, Pennsylvania: 8_900_000, "Rhode Island": 800_000, "South Carolina": 3_400_000,
  "South Dakota": 600_000, Tennessee: 4_300_000, Texas: 18_000_000, Utah: 1_800_000,
  Vermont: 500_000, Virginia: 6_000_000, Washington: 4_900_000, "West Virginia": 1_200_000,
  Wisconsin: 3_700_000, Wyoming: 300_000,
};
