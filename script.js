// Initialize Cesium viewer
Cesium.Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmMmY2MzEzMy00MDk0LTQ5OGEtYTBmNS0xZGI2YTJhZGI1NTEiLCJpZCI6Mjg0NTI1LCJpYXQiOjE3NDIwMzY5MDJ9.3SeYFhsy1IMwOwH0N2mHMaDHlXCRXZ8Mt58o7VyufaI";

// Create the Cesium viewer
const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  baseLayerPicker: false,
  geocoder: false,
  homeButton: false,
  sceneModePicker: false,
  navigationHelpButton: false,
  animation: false,
  timeline: false,
  fullscreenButton: false,
  selectionIndicator: false,
  infoBox: false,
});

// Add Bing Maps Aerial imagery layer
(async () => {
  try {
    const layer = viewer.imageryLayers.addImageryProvider(
      await Cesium.IonImageryProvider.fromAssetId(3)
    );
    console.log("Imagery layer added successfully");
  } catch (error) {
    console.error("Error adding imagery layer:", error);
  }
})();

// Set initial camera position
viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(0, 0, 20000000),
  orientation: {
    heading: 0.0,
    pitch: -Math.PI / 2,
    roll: 0.0,
  },
});

// News data storage
let newsData = [];
let filteredNewsData = [];
let activeCategories = [
  "Business",
  "Politics",
  "Technology",
  "Sports",
  "Health",
  "Entertainment",
];

// Map for tracking entity by news ID
const newsEntities = new Map();

// Load news data from CSV
async function loadNewsData() {
  try {
    const response = await fetch("news.csv");
    const csvData = await response.text();

    console.log(
      "CSV data loaded, first 100 characters:",
      csvData.substring(0, 100)
    );

    Papa.parse(csvData, {
      header: true,
      complete: function (results) {
        console.log("CSV parsing complete, found rows:", results.data.length);

        newsData = results.data
          .map((item, index) => ({
            id: index + 1,
            title: item.Title,
            summary: item.Description,
            category: item.Category,
            location: item.Location,
            timestamp: new Date(item.Timestamp),
            lat: parseFloat(item.Latitude),
            lng: parseFloat(item.Longitude),
          }))
          .filter((item) => !isNaN(item.lat) && !isNaN(item.lng));

        console.log("Processed news data, valid items:", newsData.length);

        // Sort news by timestamp (newest first)
        newsData.sort((a, b) => b.timestamp - a.timestamp);

        // Apply initial filters
        filterNewsByCategories();

        // Show headline banner with the latest news
        if (newsData.length > 0) {
          showHeadlineBanner(newsData[0]);
        }
      },
      error: function (error) {
        console.error("Error parsing CSV:", error);
      },
    });
  } catch (error) {
    console.error("Error loading news data:", error);
  }
}

// Filter news by categories
function filterNewsByCategories() {
  // Filter by categories
  filteredNewsData = newsData.filter((item) =>
    activeCategories.includes(item.category)
  );

  // Update markers and sidebar
  clearNewsMarkers();
  addNewsMarkers();
  populateNewsList();
}

// Clear all news markers
function clearNewsMarkers() {
  newsEntities.forEach((entity) => {
    viewer.entities.remove(entity);
  });
  newsEntities.clear();
}

// Add news markers to the globe
function addNewsMarkers() {
  // Group news by location
  const locationGroups = {};

  filteredNewsData.forEach((item) => {
    const locationKey = `${item.lat.toFixed(4)},${item.lng.toFixed(4)}`;
    if (!locationGroups[locationKey]) {
      locationGroups[locationKey] = [];
    }
    locationGroups[locationKey].push(item);
  });

  // Add markers for each location
  Object.keys(locationGroups).forEach((locationKey) => {
    const items = locationGroups[locationKey];
    const baseLocation = items[0];

    // Add markers in a small circle if there are multiple news items
    items.forEach((item, index) => {
      // Calculate offset for multiple items at same location
      let offsetLng = 0;
      let offsetLat = 0;

      if (items.length > 1) {
        // Create a small circle of markers
        const radius = 0.05; // degrees
        const angle = (index / items.length) * 2 * Math.PI;
        offsetLng = radius * Math.cos(angle);
        offsetLat = radius * Math.sin(angle);
      }

      // Get the appropriate image for the category
      const image = getCategoryImage(item.category);

      // Create a billboard entity for each news item
      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(
          baseLocation.lng + offsetLng,
          baseLocation.lat + offsetLat
        ),
        billboard: {
          image: image,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          scale: 0.15,
          disableDepthTestDistance: 0,
        },
        properties: {
          newsId: item.id,
          title: item.title,
          summary: item.summary.substring(0, 100) + "...",
          category: item.category,
          location: item.location,
        },
      });

      // Store reference to entity by news ID
      newsEntities.set(item.id, entity);
    });
  });
}

// Get the appropriate image for each category
function getCategoryImage(category) {
  switch (category) {
    case "Business":
      return "business.png";
    case "Politics":
      return "politics.png";
    case "Technology":
      return "technology2.png";
    case "Sports":
      return "sport.png";
    case "Health":
      return "health2.png";
    case "Entertainment":
      return "entertainment.png";
    default:
      return "pushpin.png"; // Default fallback
  }
}

// Populate the news sidebar
function populateNewsList() {
  const newsListElement = document.getElementById("newsList");
  newsListElement.innerHTML = "";

  if (filteredNewsData.length === 0) {
    newsListElement.innerHTML =
      '<div class="no-news">No news available for the selected categories.</div>';
    return;
  }

  filteredNewsData.forEach((item) => {
    const newsItem = document.createElement("div");
    newsItem.className = `newsItem ${item.category}`;
    newsItem.dataset.id = item.id;

    const timestamp = item.timestamp.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    newsItem.innerHTML = `
      <div class="newsItem-content">
        <h3>${item.title}</h3>
        <div class="newsItem-meta">
          <span class="category category-${item.category}">${item.category}</span>
          <span>${timestamp} - ${item.location}</span>
        </div>
      </div>
    `;

    newsItem.addEventListener("click", () => showNewsDetails(item.id));
    newsListElement.appendChild(newsItem);
  });
}

// Show detailed news when clicked
function showNewsDetails(newsId) {
  const newsItem = filteredNewsData.find((item) => item.id === newsId);
  if (!newsItem) return;

  document.getElementById("newsTitle").textContent = newsItem.title;
  document.getElementById("newsSummary").textContent = newsItem.summary;

  const categoryElem = document.getElementById("newsCategory");
  categoryElem.textContent = newsItem.category;
  categoryElem.className = `category category-${newsItem.category}`;

  const options = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  document.getElementById(
    "newsTimestamp"
  ).textContent = `${newsItem.timestamp.toLocaleDateString(
    "en-US",
    options
  )} - ${newsItem.location}`;

  document.getElementById("newsDetails").style.display = "block";
  document.getElementById("newsList").style.display = "none";

  // Fly to the location of the news
  viewer.flyTo(newsEntities.get(newsId), {
    duration: 1.5,
    offset: new Cesium.HeadingPitchRange(0, -Math.PI / 4, 500000),
  });

  // No more highlighting of entities
}

// Back button functionality
document.getElementById("backButton").addEventListener("click", () => {
  document.getElementById("newsDetails").style.display = "none";
  document.getElementById("newsList").style.display = "block";

  // Return to global view
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(0, 0, 20000000),
    orientation: {
      heading: 0.0,
      pitch: -Math.PI / 2,
      roll: 0.0,
    },
    duration: 1.5,
  });
});

// Category filter buttons
document.querySelectorAll(".categoryButton").forEach((button) => {
  button.addEventListener("click", function () {
    const category = this.dataset.category;

    if (this.classList.contains("active")) {
      // Remove category if it's active
      this.classList.remove("active");
      activeCategories = activeCategories.filter((cat) => cat !== category);
    } else {
      // Add category if it's not active
      this.classList.add("active");
      activeCategories.push(category);
    }

    filterNewsByCategories();
  });
});

// Handle selecting news via clicking on the globe
const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
handler.setInputAction(function (movement) {
  const pickedObject = viewer.scene.pick(movement.position);

  if (
    Cesium.defined(pickedObject) &&
    pickedObject.id instanceof Cesium.Entity &&
    pickedObject.id.properties &&
    pickedObject.id.properties.newsId
  ) {
    const newsId = pickedObject.id.properties.newsId.getValue();
    showNewsDetails(newsId);
  }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

// Handle hovering over entities
const tooltip = document.getElementById("tooltip");

handler.setInputAction(function (movement) {
  const pickedObject = viewer.scene.pick(movement.endPosition);

  if (
    Cesium.defined(pickedObject) &&
    pickedObject.id instanceof Cesium.Entity &&
    pickedObject.id.properties &&
    pickedObject.id.properties.title
  ) {
    const title = pickedObject.id.properties.title.getValue();
    const summary = pickedObject.id.properties.summary.getValue();
    const category = pickedObject.id.properties.category.getValue();
    const location = pickedObject.id.properties.location.getValue();

    tooltip.innerHTML = `
                    <h4>${title}</h4>
                    <p>${summary}</p>
                    <div class="tooltip-category category-${category}">${category}</div>
                    <div style="font-size: 12px; margin-top: 5px; color: #aaa;">${location}</div>
                `;
    tooltip.style.display = "block";
    tooltip.style.left = movement.endPosition.x + 15 + "px";
    tooltip.style.top = movement.endPosition.y + 15 + "px";

    // Add border color based on category
    const colorMap = {
      Business: "#3498db",
      Politics: "#e74c3c",
      Technology: "#f1c40f",
      Sports: "#2ecc71",
      Health: "#9b59b6",
      Entertainment: "#e67e22",
    };
    tooltip.style.borderLeftColor = colorMap[category] || "#555";
  } else {
    tooltip.style.display = "none";
  }
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

// Show headline banner
function showHeadlineBanner(newsItem) {
  const banner = document.getElementById("headlineBanner");
  const bannerTitle = document.getElementById("bannerTitle");
  const bannerSummary = document.getElementById("bannerSummary");
  const bannerCategory = document.getElementById("bannerCategory");
  const bannerViewButton = document.getElementById("bannerViewButton");
  const bannerProgressBar = document.getElementById("bannerProgressBar");

  // Set content
  bannerTitle.textContent = newsItem.title;
  bannerSummary.textContent = newsItem.summary.substring(0, 120) + "...";
  bannerCategory.textContent = newsItem.category;
  bannerCategory.className = `category category-${newsItem.category}`;

  // Set banner class based on category
  banner.className = `headline-banner ${newsItem.category}`;

  // Show banner
  banner.style.display = "block";

  // Reset and animate progress bar
  bannerProgressBar.style.width = "0%";

  // Use requestAnimationFrame for smoother animation
  requestAnimationFrame(() => {
    bannerProgressBar.style.transition = "width 10s linear";
    bannerProgressBar.style.width = "100%";
  });

  // Hide banner after 10 seconds
  const bannerTimeout = setTimeout(() => {
    hideBanner();
  }, 10000);

  // Store timeout ID to clear if needed
  banner.dataset.timeoutId = bannerTimeout;

  // View button functionality
  bannerViewButton.onclick = function () {
    showNewsDetails(newsItem.id);
    hideBanner();
  };

  // Close button functionality
  document.getElementById("bannerClose").onclick = function (e) {
    e.stopPropagation();
    hideBanner();
  };
}

// Hide headline banner
function hideBanner() {
  const banner = document.getElementById("headlineBanner");

  // Clear any existing timeout
  if (banner.dataset.timeoutId) {
    clearTimeout(parseInt(banner.dataset.timeoutId));
  }

  // Hide with fade out animation
  banner.style.opacity = "0";
  banner.style.transform = "translateY(-20px)";

  setTimeout(() => {
    banner.style.display = "none";
    banner.style.opacity = "1";
    banner.style.transform = "translateY(0)";
  }, 300);
}

// Rotate through headlines every 30 seconds
let headlineIndex = 0;
function rotateHeadlines() {
  if (filteredNewsData.length === 0) return;

  headlineIndex = (headlineIndex + 1) % filteredNewsData.length;
  showHeadlineBanner(filteredNewsData[headlineIndex]);

  setTimeout(rotateHeadlines, 30000);
}

// Initialize the enhanced UI elements
function initializeEnhancedUI() {
  // Setup search functionality
  const searchBar = document.querySelector('.search-bar');
  searchBar.addEventListener('input', handleSearch);
  searchBar.addEventListener('focus', () => {
    searchBar.parentElement.classList.add('active');
  });
  searchBar.addEventListener('blur', () => {
    searchBar.parentElement.classList.remove('active');
  });
  
  // Setup navigation controls
  document.getElementById('zoomIn').addEventListener('click', () => {
    zoomView(true);
  });
  
  document.getElementById('zoomOut').addEventListener('click', () => {
    zoomView(false);
  });
  
  document.getElementById('resetView').addEventListener('click', resetView);
  
  // Setup compass
  updateCompass();
  
  // Setup time indicator
  updateTimeIndicator();
  setInterval(updateTimeIndicator, 1000);
  
  // Setup zoom level indicator
  updateZoomIndicator();
  
  // Add camera change event listener
  viewer.camera.changed.addEventListener(onCameraChange);
}

// Handle search functionality
function handleSearch(event) {
  const searchTerm = event.target.value.toLowerCase();
  
  if (searchTerm.length < 2) {
    filterNewsByCategories(); // Reset to normal filtering
    return;
  }
  
  // Filter news by search term
  filteredNewsData = newsData.filter(item => {
    return (
      item.title.toLowerCase().includes(searchTerm) ||
      item.summary.toLowerCase().includes(searchTerm) ||
      item.category.toLowerCase().includes(searchTerm) ||
      item.location.toLowerCase().includes(searchTerm)
    );
  });
  
  // Update markers and sidebar
  clearNewsMarkers();
  addNewsMarkers();
  populateNewsList();
  
  // If we have a specific location match, fly to it
  const locationMatches = filteredNewsData.filter(item => 
    item.location.toLowerCase().includes(searchTerm)
  );
  
  if (locationMatches.length > 0) {
    const firstMatch = locationMatches[0];
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(firstMatch.lng, firstMatch.lat, 1000000),
      duration: 2
    });
  }
}

// Zoom view in or out
function zoomView(zoomIn) {
  const cameraHeight = viewer.camera.positionCartographic.height;
  
  // More natural zoom factors based on current height
  let zoomFactor;
  
  if (cameraHeight > 10000000) {
    zoomFactor = zoomIn ? 0.5 : 1.5; // Larger steps at high altitude
  } else if (cameraHeight > 1000000) {
    zoomFactor = zoomIn ? 0.6 : 1.4; // Medium steps at medium altitude
  } else {
    zoomFactor = zoomIn ? 0.7 : 1.3; // Smaller steps at low altitude
  }
  
  const newHeight = cameraHeight * zoomFactor;
  
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromRadians(
      viewer.camera.positionCartographic.longitude,
      viewer.camera.positionCartographic.latitude,
      newHeight
    ),
    duration: 1
  });
}

// Reset view to default
function resetView() {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(0, 0, 20000000),
    orientation: {
      heading: 0.0,
      pitch: -Math.PI/2,
      roll: 0.0
    },
    duration: 2
  });
}

// Update compass direction
function updateCompass() {
  // Get the camera heading and convert to degrees
  const heading = viewer.camera.heading;
  const compassNeedle = document.getElementById('compassNeedle');
  
  // Adjust the rotation to point correctly to north
  // North should be at 0 degrees, so we rotate in the opposite direction of the camera heading
  compassNeedle.style.transform = `rotate(${-Cesium.Math.toDegrees(heading)}deg)`;
}

// Update time indicator
function updateTimeIndicator() {
  const now = new Date();
  document.getElementById('localTime').textContent = now.toLocaleTimeString();
}

// Update zoom level indicator
function updateZoomIndicator() {
  const height = viewer.camera.positionCartographic.height;
  let displayValue;
  
  if (height > 1000000) {
    // More accurate representation for large distances
    const millionKm = height / 1000000;
    if (millionKm >= 10) {
      displayValue = `${millionKm.toFixed(1)} million km`;
    } else {
      displayValue = `${millionKm.toFixed(2)} million km`;
    }
  } else if (height > 1000) {
    // More precise km representation
    displayValue = `${(height / 1000).toFixed(1)} km`;
  } else {
    // Meters representation
    displayValue = `${Math.round(height)} m`;
  }
  
  // Update the zoom level display
  document.getElementById('zoomLevel').textContent = displayValue;
}

// Handle camera change events
function onCameraChange() {
  updateCompass();
  updateZoomIndicator();
}

// Add this to your initialization code
viewer.scene.globe.tileLoadProgressEvent.addEventListener((remainingTiles) => {
  if (remainingTiles === 0) {
    // Remove loading indicator
    document.getElementById("loadingIndicator").style.display = "none";
    
    // Initialize enhanced UI
    initializeEnhancedUI();
    
    // Load news data
    loadNewsData().then(() => {
      // Start rotating headlines after data is loaded
      setTimeout(rotateHeadlines, 15000);
    });
  }
});

// Fix the back button issue by ensuring it's hidden initially
document.addEventListener('DOMContentLoaded', function() {
  // Hide the news details view initially
  document.getElementById('newsDetails').style.display = 'none';
});

// Update the back button to include an arrow icon
document.getElementById("backButton").innerHTML = "Back to news list";
