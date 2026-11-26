// Aurora Courier — mission flow: briefing, flying, landing, crash, and the
// campaign that steps through the three sorties with a running total.

import { MISSIONS } from './config.js';

export class Campaign {
  constructor() {
    this.missionIndex = 0;
    this.totalScore = 0;
    this.completed = [];
    this.state = 'title'; // title | briefing | flying | paused | landed | crashed | done
    this.message = '';
    this.messageTimer = 0;
  }

  get mission() {
    return MISSIONS[this.missionIndex];
  }

  get isLastMission() {
    return this.missionIndex >= MISSIONS.length - 1;
  }

  startBriefing() {
    this.state = 'briefing';
  }

  beginFlight() {
    this.state = 'flying';
  }

  pause() {
    if (this.state === 'flying') this.state = 'paused';
  }

  resume() {
    if (this.state === 'paused') this.state = 'flying';
  }

  onLanded(plane) {
    this.totalScore += plane.score;
    this.completed.push({ name: this.mission.name, score: plane.score });
    this.state = 'landed';
  }

  onCrashed(plane) {
    this.totalScore += plane.score;
    this.state = 'crashed';
  }

  nextMission() {
    if (this.isLastMission) {
      this.state = 'done';
      return false;
    }
    this.missionIndex++;
    this.state = 'briefing';
    return true;
  }

  restartMission() {
    this.state = 'briefing';
  }

  restartCampaign() {
    this.missionIndex = 0;
    this.totalScore = 0;
    this.completed = [];
    this.state = 'title';
  }

  flash(text, seconds = 2.5) {
    this.message = text;
    this.messageTimer = seconds;
  }

  tick(dt) {
    if (this.messageTimer > 0) this.messageTimer -= dt;
  }
}
