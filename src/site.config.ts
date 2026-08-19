export interface Link {
  label: string;
  href: string;
}

export const site = {
  name: "Swansea University Esports",
  shortName: "Swansea Esports",
  handle: "SwanseaGG",
  url: "https://swanseauniesports.co.uk",
  description:
    "Swansea University Esports (SwanseaGG). Competitive teams in Valorant, League of Legends, Overwatch 2, CS2, Rainbow Six Siege, Rocket League and Apex Legends, plus socials, LANs and watch parties.",
  discord: "https://discord.gg/swansea",
  studentsUnion: "https://www.swansea-union.co.uk/activities/society/swanseaesports/",
  merch: "https://esk.gg/collections/swansea-esports",
  email: "esports@swansea-societies.co.uk",

  nav: [
    { label: "Home", href: "/" },
    { label: "Committee", href: "/committee" },
    { label: "Events", href: "/events" },
    { label: "News", href: "/news" },
    { label: "Achievements", href: "/achievements" },
    { label: "About", href: "/about" }
  ],

  socials: [
    { label: "Discord", href: "https://discord.gg/swansea" },
    { label: "Students' Union", href: "https://www.swansea-union.co.uk/activities/society/swanseaesports/" },
    { label: "Merch Store", href: "https://esk.gg/collections/swansea-esports" },
    { label: "Instagram", href: "https://instagram.com/swanseagg" },
    { label: "Twitter / X", href: "https://twitter.com/swanseagg" },
    { label: "Twitch", href: "https://twitch.tv/swanseagg" },
    { label: "Steam", href: "https://steamcommunity.com/groups/SwanseaGG" }
  ],

  competitions: [
    { label: "NUEL", href: "https://thenuel.com/university/swansea-university" },
    { label: "NSE", href: "https://www.nse.gg/universities/swansea-university/" }
  ]
};
