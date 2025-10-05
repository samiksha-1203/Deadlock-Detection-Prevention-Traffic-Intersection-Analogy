🚦 Deadlock Detection & Prevention Simulator 🧠💻
🔍 Operating Systems Project

An interactive web-based simulation that demonstrates Deadlock Detection and Prevention using:

🧩 Resource Allocation Graph (RAG)

🏦 Banker’s Algorithm

🚗 Traffic Intersection Analogy

🎯 Project Overview

This simulator visualizes how deadlocks occur in an Operating System’s resource allocation and how algorithms like Banker’s Algorithm prevent unsafe states.

Cars 🏎️ represent processes, and road lanes/center act as resources.
When multiple cars wait for each other in a circular pattern, a deadlock occurs — just like in resource graphs!

🧱 Concepts Covered
Concept	Description
💠 Coffman Conditions	Demonstrates all 4 conditions for a deadlock (Mutual Exclusion, Hold & Wait, No Preemption, Circular Wait).
🔁 RAG Cycle Detection	Detects deadlocks by identifying cycles in the resource allocation graph.
🏦 Banker’s Algorithm	Prevents deadlocks by checking for a safe sequence before granting resources.
🌙 Dark Mode	Toggle dark/light themes for better visuals.
🧩 Simulation Features

🧭 Add cars from North, South, East, West to simulate processes.

⚙️ Observe allocation & request of resources.

🔴 Detect deadlocks via RAG cycle detection.

🧮 Run Banker’s Algorithm to find a safe sequence (with matrices displayed).

📊 Visualize RAG dynamically (Processes ⭕, Resources ⬜, Arrows for allocation/request).

🧠 Log panel tracks every step of the simulation in real-time.

🖼️ How It Works (Step-by-Step)

Add Cars (Processes) using the control buttons.

Each car requests its first resource (lane).

Once allocated, it requests the next resource (intersection).

If a cycle is formed in the RAG → Deadlock Detected! ⚠️

Click Run Banker’s Algorithm → See allocation, need, available matrices.

If a safe sequence exists → Resources are released safely ✅
Otherwise → Unsafe state / Potential Deadlock ❌

Reset Simulation anytime to start fresh 🔄

📁 Project Structure
Deadlock-Detection-Prevention/
│
├── index.html        # Main interface (UI layout & structure)
├── css/
│   └── styles.css    # Styling, dark mode, responsive layout
├── js/
│   └── script.js     # Core logic: RAG, Banker’s Algorithm, simulation
├── assets/
│   └── favicon/      # Icons for browser tab
└── README.md         # You are here! 📘

🧠 Tech Stack

⚡ HTML5, CSS3, JavaScript (Vanilla)

🎨 Responsive Design (mobile-friendly)

🕶️ Custom Dark/Light Mode

🧾 Canvas API for live RAG visualization

🧪 Algorithms Used
🧮 Banker’s Algorithm

Used to ensure the system is always in a safe state by checking if all processes can complete with current resources.

🔄 Deadlock Detection

Implemented using Depth-First Search (DFS) to find cycles in the Resource Allocation Graph (RAG).

📘 Learning Outcomes

Understanding of resource allocation and synchronization in OS.

Visualization of deadlock formation.

Simulation of Banker’s Algorithm with live data.

Better grasp of Coffman’s Conditions.

🏁 How to Run

Clone or download this repository.

Open index.html in your browser 🌐.

Add cars ➕, detect deadlock ⚠️, run banker’s algorithm 🧮, and enjoy learning OS visually!

🌟 Demo Snapshot

(Optional – Add screenshots here later)
📸 Example:
Simulation showing RAG with cycle and deadlocked cars

💡 Future Improvements

🔁 Add step-by-step animation for Banker’s execution.

📈 Display process execution timeline (Gantt view).

🧩 Add more resources and dynamic matrix inputs.