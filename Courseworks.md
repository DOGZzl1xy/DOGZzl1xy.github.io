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

/* layout only — colors, borders, and fonts come from the site theme */
.coursework-item {
  padding: 20px;
  text-align: center;
  transition: transform 0.2s;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.coursework-item img {
  width: 100%;
  height: 200px;
  object-fit: contain; /* Ensure image fits without cropping */
  margin-bottom: 15px;
}

.coursework-item h3 {
  font-size: 1.2em;
  margin-bottom: 15px;
  min-height: 3em;
}

.learn-more-btn {
  margin-top: auto;
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
    <img src="/courseworks_file/course-BayWheel/BayWheel_Map_web.jpg" alt="Bay Wheels GIS Analysis" loading="lazy" decoding="async">
    <a href="/course-cy-plan-110.html" class="learn-more-btn">View Project</a>
  </div>

  <!-- Project 2 -->
  <div class="coursework-item">
    <h3>[WUPENiCity] Field Research on Optimization of P+R Systems</h3>
    <img src="/courseworks_file/course-wupen/06_web.jpg" alt="Hangzhou P+R System Analysis" loading="lazy" decoding="async">
    <a href="/course-wupen-icity.html" class="learn-more-btn">View Project</a>
  </div>

  <div class="coursework-item">
    <h3>[Landscape Design] Island of Lake of Zijingang Campus</h3>
    <img src="/courseworks_file/landscape-design/landscape_cover_1_web.jpg" alt="Landscape Design of Island of Lake of Zijingang Campus" loading="lazy" decoding="async">
    <a href="/course-landscape-design-1.html" class="learn-more-btn">View Project</a>
  </div>


  <div class="coursework-item">
    <h3>[Landscape Design] Qiushi Road</h3>
    <img src="/courseworks_file/landscape-design/landscape_cover_2_web.jpg" alt="Landscape Design of Qiushi Road" loading="lazy" decoding="async">
    <a href="/course-landscape-design-2.html" class="learn-more-btn">View Project</a>
  </div>
  

  <div class="coursework-item">
    <h3>[Regulatory Detailed Planning] Tangbei Block, Hangzhou</h3>
    <img src="/courseworks_file/regulatory-planning/regulatory_planning_cover_web.jpg" alt="Regulatory Detailed Planning of Tangbei Block" loading="lazy" decoding="async">
    <a href="/course-regulatory-planning.html" class="learn-more-btn">View Project</a>
  </div>


</div>
