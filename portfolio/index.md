---
layout: page
permalink: /portfolio/index.html
title: Portfolio
---

# Portfolio

Here is a collection of my research and design projects.

<style>
.coursework-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 30px;
  margin-top: 30px;
}

.coursework-item {
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

.coursework-item:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
}

.coursework-item img {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: 4px;
  margin-bottom: 15px;
  background-color: #f0f0f0;
}

.coursework-item h3 {
  font-size: 1.2em;
  margin-bottom: 15px;
  min-height: 3em;
}

.learn-more-btn {
  display: inline-block;
  padding: 8px 20px;
  background-color: #333 !important;
  color: white !important;
  text-decoration: none;
  border-radius: 4px;
  margin-top: auto;
  opacity: 1 !important;
  transform: none !important;
  border: none !important;
}

.learn-more-btn:hover {
  background-color: #555 !important;
  color: white !important;
  text-decoration: none;
}

@media (max-width: 768px) {
  .coursework-grid {
    grid-template-columns: 1fr;
  }
}
</style>

<div class="coursework-grid">
  
  <!-- Project 1: SVF -->
  <div class="coursework-item">
    <h3>Sidewalk Sky View Factor Visualization</h3>
    <!-- Placeholder image - User should replace this -->
    <div style="width:100%; height:200px; background: linear-gradient(45deg, #003366, #00bcd4); display:flex; align-items:center; justify-content:center; color:white; margin-bottom:15px; border-radius:4px;">
        SVF Visualization
    </div>
    <a href="/portfolio/SVF/index.html" class="learn-more-btn">View Project</a>
  </div>

</div>
