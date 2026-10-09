const products = [
  {
    id: 1,
    picture:
      "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=900&q=80",
    title: "Classic Haircut",
    description:
      "A clean classic haircut finished with styling and attention to detail.",
    price: 200,
    oldPrice: 250,
    category: "haircut",
    duration: 30,
    active: true,
  },

  {
    id: 2,
    picture:
      "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=900&q=80",
    title: "Skin Fade",
    description:
      "A sharp skin fade with clean transitions and a polished finish.",
    price: 250,
    oldPrice: null,
    category: "haircut",
    duration: 45,
    active: true,
  },

  {
    id: 3,
    picture:
      "https://images.unsplash.com/photo-1622286346003-c8a0f7c1f8c5?auto=format&fit=crop&w=900&q=80",
    title: "Haircut + Beard",
    description:
      "Complete haircut and beard grooming for a fresh full look.",
    price: 300,
    oldPrice: 350,
    category: "package",
    duration: 60,
    active: true,

    gallery: [
      "https://images.unsplash.com/photo-1622287162716-f311baa1a2b8?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1621607512214-68297480165e?auto=format&fit=crop&w=500&q=80",
            "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=500&q=80",
      "https://images.unsplash.com/photo-1517832207067-4db24a2ae47c?auto=format&fit=crop&w=500&q=80",
    ],

    popupDescription:
      "Our complete grooming package combines a precision haircut with beard shaping and finishing. Perfect when you want the full Hadad experience.",
  },

  {
    id: 4,
    picture:
      "https://images.unsplash.com/photo-1620331311520-246422fd82f9?auto=format&fit=crop&w=900&q=80",
    title: "Premium Grooming",
    description:
      "Our full grooming package for a complete premium experience.",
    price: 450,
    oldPrice: 500,
    category: "package",
    duration: 75,
    active: true,

    gallery: [
      "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1621607512214-68297480165e?auto=format&fit=crop&w=500&q=80",
      "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=500&q=80",
    ],

    popupDescription:
      "Premium grooming with haircut styling, beard work and finishing touches designed to leave you looking your best.",
  },
];

export default products;