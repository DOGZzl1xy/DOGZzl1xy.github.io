---
layout: page
permalink: /course-works/index.html
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
}

.coursework-item h3 {
  font-size: 1.2em;
  margin-bottom: 15px;
  min-height: 3em; /* Align titles */
}

.learn-more-btn {
  display: inline-block;
  padding: 8px 20px;
  background-color: #333;
  color: white;
  text-decoration: none;
  border-radius: 4px;
  margin-top: auto;
}

.learn-more-btn:hover {
  background-color: #555;
  color: white;
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
    <a href="/project-cy-plan-110.html" class="learn-more-btn">View Project</a>
  </div>

  <!-- Project 2 -->
  <div class="coursework-item">
    <h3>[WUPENiCity] Field Research on Optimization of P+R Systems</h3>
    <img src="/courseworks_file/course-wupen/06.png" alt="Hangzhou P+R System Analysis">
    <a href="/project-wupen-icity.html" class="learn-more-btn">View Project</a>
  </div>

</div>
