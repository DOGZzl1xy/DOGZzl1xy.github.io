---
layout: page
permalink: /courseworks/index.html
title: Course Works
---

# Course works

Here is a collection of my major course works. Click on a project to learn more.

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
  background-color: #fff; /* Ensure background is white */
}

.coursework-item:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
}

.coursework-item img {
  width: 100%;
  height: 200px;
  object-fit: contain; /* Ensure image fits without cropping */
  border-radius: 4px;
  margin-bottom: 15px;
  background-color: #fff; /* Optional: background for empty space */
}

.coursework-item h3 {
  font-size: 1.2em;
  margin-bottom: 15px;
  min-height: 3em;
}

.learn-more-btn {
  display: inline-block;
  padding: 8px 20px;
  background-color: #333 !important; /* Force black background */
  color: white !important; /* Force white text */
  text-decoration: none;
  border-radius: 4px;
  margin-top: auto;
  opacity: 1 !important; /* Ensure visible */
  transform: none !important;
  border: none !important; /* Override main.css border */
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
  
  <!-- Project 1 -->
  <div class="coursework-item">
    <h3>[CY PLAN 110] Introduction to City Planning</h3>
    <img src="/courseworks_file/course-BayWheel/BayWheel_Map.png" alt="Bay Wheels GIS Analysis">
    <a href="/course-cy-plan-110.html" class="learn-more-btn">View Project</a>
  </div>

  <!-- Project 2 -->
  <div class="coursework-item">
    <h3>[WUPENiCity] Field Research on Optimization of P+R Systems</h3>
    <img src="/courseworks_file/course-wupen/06.png" alt="Hangzhou P+R System Analysis">
    <a href="/course-wupen-icity.html" class="learn-more-btn">View Project</a>
  </div>

  <div class="coursework-item">
    <h3>[Landscape Design] Island of Lake of Zijingang Campus</h3>
    <img src="/courseworks_file/landscape-design/landscape_cover_1.jpg" alt="Landscape Design of Island of Lake of Zijingang Campus">
    <a href="/course-landscape-design-1.html" class="learn-more-btn">View Project</a>
  </div>


  <div class="coursework-item">
    <h3>[Landscape Design] Qiushi Road</h3>
    <img src="/courseworks_file/landscape-design/landscape_cover_2.png" alt="Landscape Design of Qiushi Road">
    <a href="/course-landscape-design-2.html" class="learn-more-btn">View Project</a>
  </div>
</div>
