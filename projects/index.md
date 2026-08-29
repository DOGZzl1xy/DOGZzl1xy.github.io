---
layout: page
permalink: /projects/index.html
title: Projects
---

# Research Projects

Four directions I keep coming back to: mobility simulation, street-level microclimate, green space equity, and how the built environment shapes health and recovery.

<style>
.project-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 30px;
  margin-top: 30px;
}

/* layout only — colors, borders, and fonts come from the site theme */
.project-card {
  padding: 20px;
  text-align: center;
  transition: transform 0.2s;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.project-card img {
  width: 100%;
  height: 200px;
  object-fit: contain;
  margin-bottom: 15px;
}

.project-card h3 {
  font-size: 1.2em;
  margin-bottom: 10px;
  min-height: 2em;
}

.project-card p {
  font-size: 0.9em;
  margin-bottom: 15px;
}

.project-btn {
  display: inline-block;
  padding: 8px 20px;
  text-decoration: none;
  margin-top: auto;
}

@media (max-width: 768px) {
  .project-grid {
    grid-template-columns: 1fr;
  }
}
</style>

<div class="project-grid">

  <div class="project-card">
    <h3>Urban Air Mobility</h3>
    <img src="/mypaper/urban-air-mobility/AAM_poster_and_elevator_pitch_1_web.jpg" alt="Urban Air Mobility" loading="lazy" decoding="async">
    <p>Optimizing UAM systems with dynamic demand and heterogeneous fleets in the SF Bay Area.</p>
    <a href="/urban-air-mobility/" class="project-btn">View Project</a>
  </div>

  <div class="project-card">
    <h3>Sky View Factor</h3>
    <img src="/images/svf-street-view.jpg" alt="Panoramic street view used in the Sky View Factor project" loading="lazy" decoding="async">
    <p>Comparing LiDAR-based and imagery-based SVF at pedestrian scale, with an interactive San Francisco demo.</p>
    <a href="/sky-view-factor/" class="project-btn">View Project</a>
  </div>

  <div class="project-card">
    <h3>Urban Green Space</h3>
    <img src="/mypaper/urban-green-space/framework.png" alt="Urban Green Space" loading="lazy" decoding="async">
    <p>Examining urban greenery equity and community vitality in shrinking cities.</p>
    <a href="/urban-green-space/" class="project-btn">View Project</a>
  </div>

  <div class="project-card">
    <h3>Urban Built Environment</h3>
    <img src="/mypaper/urban-built-env/Nagoya_recovery/Recovery_level_web.jpg" alt="Urban Built Environment" loading="lazy" decoding="async">
    <p>Analyzing the built environment's impact on post-pandemic recovery and public health.</p>
    <a href="/urban-built-environment/" class="project-btn">View Project</a>
  </div>

</div>
