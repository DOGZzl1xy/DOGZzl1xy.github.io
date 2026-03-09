---
layout: page
permalink: /projects/index.html
title: Projects
---

# Research Projects

Here is a collection of my research projects. Click on a project to learn more.

<style>
.project-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 30px;
  margin-top: 30px;
}

.project-card {
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  transition: transform 0.2s;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background-color: #fff;
}

.project-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
}

.project-card img {
  width: 100%;
  height: 200px;
  object-fit: contain;
  border-radius: 4px;
  margin-bottom: 15px;
  background-color: #fff;
}

.project-card h3 {
  font-size: 1.2em;
  margin-bottom: 10px;
  min-height: 2em;
}

.project-card p {
  font-size: 0.9em;
  color: #555;
  margin-bottom: 15px;
}

.project-btn {
  display: inline-block;
  padding: 8px 20px;
  background-color: #333;
  color: white;
  text-decoration: none;
  border-radius: 4px;
  margin-top: auto;
}

.project-btn:hover {
  background-color: #555;
  color: white;
  text-decoration: none;
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
    <img src="/mypaper/urban-air-mobility/AAM_poster_and_elevator_pitch_1.png" alt="Urban Air Mobility">
    <p>Optimizing UAM systems with dynamic demand and heterogeneous fleets in the SF Bay Area.</p>
    <a href="/urban-air-mobility/" class="project-btn">View Project</a>
  </div>

  <div class="project-card">
    <h3>Sky View Factor</h3>
    <img src="/images/fav.png" alt="Sky View Factor">
    <p>Comparing LiDAR-based SVF with traditional imagery-based methods for microclimate analysis.</p>
    <a href="/sky-view-factor/" class="project-btn">View Project</a>
  </div>

  <div class="project-card">
    <h3>Urban Green Space</h3>
    <img src="/mypaper/urban-green-space/framework.png" alt="Urban Green Space">
    <p>Examining urban greenery equity and community vitality in shrinking cities.</p>
    <a href="/urban-green-space/" class="project-btn">View Project</a>
  </div>

  <div class="project-card">
    <h3>Urban Built Environment</h3>
    <img src="/mypaper/urban-built-env/Nagoya_recovery/Recovery_level.png" alt="Urban Built Environment">
    <p>Analyzing the built environment's impact on post-pandemic recovery and public health.</p>
    <a href="/urban-built-environment/" class="project-btn">View Project</a>
  </div>

</div>
