// Import Chart.js
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale
} from 'https://cdn.jsdelivr.net/npm/chart.js@3.7.1/+esm';

// Register Chart.js components
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale
);

// Firebase RTDB REST URL
const DATABASE_URL =
  "https://watertankdb-default-rtdb.firebaseio.com/UltraSonicSensor.json";

// Charts management object
const charts = {
  instances: {},

  destroyAll: function () {
    Object.values(this.instances).forEach(chart => chart.destroy());
    this.instances = {};
  }
};

// Water level visualization function
function setWaterLevel(level) {

  const waterTank = document.querySelector('.water-tank');
  const waterFill = document.querySelector('.water-level');

  if (!waterTank || !waterFill) {
    console.error("Water tank elements not found");
    return;
  }

  level = Number(level);

  if (isNaN(level)) {
    console.error("Invalid water level");
    return;
  }

  waterFill.style.display = 'block';
  waterFill.style.position = 'absolute';
  waterFill.style.bottom = '0';
  waterFill.style.width = '100%';
  waterFill.style.height = `${level}%`;

  if (level < 20) {
    waterFill.style.backgroundColor = '#ff4d4d';
  } else if (level < 50) {
    waterFill.style.backgroundColor = '#00b4d8';
  } else {
    waterFill.style.backgroundColor = '#3399ff';
  }

  waterFill.style.animation =
    `wave ${level < 20 ? '1s' : '2s'} infinite linear`;
}

// Calculate averages
function calculateAverages(observations, period) {

  const averages = {};

  observations.forEach((obs, index) => {

    const date = new Date(obs.Time);

    let key;

    if (period === 'daily') {

      key = date.toISOString().split('T')[0];

    } else if (period === 'weekly') {

      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());

      key = weekStart.toISOString().split('T')[0];

    } else if (period === 'monthly') {

      key = `${date.getFullYear()}-${date.getMonth()}`;

    } else if (period === 'annual') {

      key = date.getFullYear();
    }

    if (!averages[key]) {

      averages[key] = {
        sum: 0,
        count: 0,
        time: obs.Time
      };
    }

    const distance = Number(obs.Distance_cm);

    if (!isNaN(distance) && index > 0) {

      const prevDistance =
        Number(observations[index - 1].Distance_cm);

      if (!isNaN(prevDistance)) {

        const diff =
          ((82 - distance) - (82 - prevDistance)) / 100 * 12;

        if (diff < 0) {

          averages[key].sum += diff;
          averages[key].count++;
        }
      }
    }
  });

  return Object.entries(averages).map(([key, value]) => {

    return {
      time: value.time,
      average:
        value.count > 0
          ? value.sum / value.count
          : 0
    };
  });
}

// Update charts
function updateCharts(observations) {

  try {

    charts.destroyAll();

  } catch (e) {

    console.error(e);
  }

  // Sort ascending
  observations.sort(
    (a, b) => new Date(a.Time) - new Date(b.Time)
  );

  // Raw chart
  charts.instances.distance = new Chart(
    document.getElementById('distanceChart'),
    {
      type: 'line',

      data: {

        labels: observations.map(o =>
          new Date(o.Time).toLocaleString()
        ),

        datasets: [{

          label: 'Water Level',

          data: observations.map(o =>
            82 - Number(o.Distance_cm)
          ),

          borderColor: 'rgb(75, 192, 192)',

          tension: 0.1
        }]
      }
    }
  );

  // Daily averages
  const dailyAverages =
    calculateAverages(observations, 'daily');

  charts.instances.daily = new Chart(
    document.getElementById('dailyChart'),
    {
      type: 'line',

      data: {

        labels: dailyAverages.map(d =>
          new Date(d.time).toLocaleDateString()
        ),

        datasets: [{

          label: 'Daily Average Consumption',

          data: dailyAverages.map(d => d.average),

          borderColor: 'rgb(255, 99, 132)',

          tension: 0.1
        }]
      }
    }
  );
}

// Load Firebase data
async function loadData() {

  try {

    const response = await fetch(DATABASE_URL);

    if (!response.ok) {
      throw new Error("Failed to fetch Firebase data");
    }

    const data = await response.json();

    if (!data) {

      console.log("No data available");
      return;
    }

    const observations = Object.entries(data)
      .filter(([_, obs]) => obs.Time)
      .map(([id, obs]) => ({
        id,
        ...obs
      }));

    // Sort newest first
    observations.sort(
      (a, b) => new Date(b.Time) - new Date(a.Time)
    );

    const newestObservation = observations[0];

    let distance =
      Number(newestObservation["Distance_cm"]);

    const time = newestObservation["Time"];

    distance =
      Math.max(0, Math.min(82, 82 - distance));

    let distanceCM = distance;

    let percentage =
      (distance / 70) * 100;

    percentage = percentage.toFixed(1);

    document.getElementById("distanceValue")
      .textContent = percentage;

    document.getElementById("distanceValue1")
      .textContent = distanceCM;

    document.getElementById("timeValue")
      .textContent = time;

    setWaterLevel(percentage);

    updateCharts(observations);

  } catch (error) {

    console.error("Firebase fetch error:", error);
  }
}



async function measureNow() {

  try {

    await fetch(
      "https://watertankdb-default-rtdb.firebaseio.com/MeasureNow.json",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(true)
      }
    );

    alert("Measurement requested!");

  } catch (error) {

    console.error(error);

    alert("Failed to request measurement");
  }
}




// Load initially
document.addEventListener('DOMContentLoaded', () => {

  document
    .getElementById("measureBtn")
    .addEventListener("click", measureNow);

  loadData();

  setInterval(loadData, 10000);
});
