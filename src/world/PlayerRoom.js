// src/world/PlayerRoom.js

const glowSpots = [
  { class: "small", left: 21.71, top: 20.72, size: 55, delay: 0.1, label: "Lantern near door" },
  { class: "small", left: 36.96, top: 16.26, size: 55, delay: 0.6, label: "Wall lantern near wardrobe" },
  { class: "small", left: 51.08, top: 14.77, size: 32, delay: 1.1, label: "Candle 1 fireplace mantel" },
  { class: "small", left: 52.87, top: 14.35, size: 32, delay: 0.7, label: "Candle 2 fireplace mantel" },
  { class: "fireplace", left: 48.4, top: 28.7, width: 170, height: 120, delay: 0, label: "Fireplace fire" },
  { class: "small", left: 78.53, top: 10.1, size: 50, delay: 1.6, label: "Wall lantern near bookshelf" },
  { class: "small", left: 81.22, top: 17.32, size: 42, delay: 0.4, label: "Glowing bottle 1" },
  { class: "small", left: 83.61, top: 16.79, size: 42, delay: 1.0, label: "Glowing bottle 2" },
  { class: "small", left: 48.92, top: 51.33, size: 50, delay: 0.9, label: "Candle center table" },
  { class: "small", left: 11.3,  top: 56.11, size: 50, delay: 1.3, label: "Lantern left desk" },
  { class: "small", left: 80.44, top: 49.2,  size: 55, delay: 0.2, label: "Lantern right table" },
  { class: "small", left: 77.51, top: 71.09, size: 45, delay: 1.8, label: "Lantern bottom right crates" },
];

export class PlayerRoom {
  constructor({ character, containerSelector = ".room-container" } = {}) {
    this.character = character ?? null;   // dito na-store yung buong pinili na character
    this.container = document.querySelector(containerSelector);
    this.glowElements = [];
  }

  show() {
    if (!this.container) {
      console.error("PlayerRoom: container not found");
      return;
    }

    this._renderGlows();

    if (this.character) {
      console.log(`[PlayerRoom] Loaded with character: ${this.character.name} (${this.character.echoName})`);
      // dito mo gagamitin yung this.character para i-display yung sprite/portrait
      // ng napiling character sa loob ng room, hal.:
      // this._renderCharacterSprite(this.character);
    } else {
      console.warn("[PlayerRoom] Walang na-pass na character!");
    }
  }

  _renderGlows() {
    glowSpots.forEach(spot => {
      const div = document.createElement("div");
      div.classList.add("glow", spot.class);

      const width = spot.width || spot.size;
      const height = spot.height || spot.size;

      div.style.left = spot.left + "%";
      div.style.top = spot.top + "%";
      div.style.width = width + "px";
      div.style.height = height + "px";
      div.style.animationDelay = spot.delay + "s";

      this.container.appendChild(div);
      this.glowElements.push(div);
    });
  }

  destroy() {
    this.glowElements.forEach(el => el.remove());
    this.glowElements = [];
    if (this.container) this.container.remove();
  }
}