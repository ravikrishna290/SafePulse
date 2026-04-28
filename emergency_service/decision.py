from datetime import datetime, timezone
from typing import Optional

def calculate_decision(nlp_scores: dict, crowd_density: int, movement: str, noise_level: int, prev_crowd: Optional[int] = None, zone: str = "lobby") -> dict:
    """
    Decision engine that combines NLP outputs with sensor telemetry, predicts future risk, and computes action confidence.
    """
    # 1. Base label and confidence from NLP
    final_type = max(nlp_scores, key=nlp_scores.get)
    confidence = min(nlp_scores[final_type], 1.0)

    explanation_parts = [f"{final_type.capitalize()}-related situation detected from text."]

    # 2. Multi-Signal Fusion (Calculate Risk)
    if final_type == "normal":
        risk = (1.0 - confidence) * 30  # High confidence in normal means very low risk
    else:
        risk = confidence * 100
    
    # Stronger weighting for real-world severity
    if final_type == "panic":
        risk += 15
    elif final_type == "fire":
        risk += 20

    if crowd_density > 70 and movement.lower() == "high":
        risk += 15
        explanation_parts.append("High crowd density and rapid movement increased risk.")

    if noise_level > 80:
        risk += 15
        explanation_parts.append("High noise level increased risk.")

    if prev_crowd is not None and crowd_density > prev_crowd:
        risk += 10
        explanation_parts.append("Crowd density is trending upwards.")

    # Critical Escalation
    if crowd_density > 85 and movement.lower() == "high":
        risk = max(risk, 90)
        explanation_parts.append("Critical crowd surge detected.")

    # Cap risk at 100
    risk = min(100.0, risk)

    # 3. Prediction Engine
    prediction = "stable"
    if crowd_density > 70:
        prediction = "risk likely to increase in next 2 minutes"
        
    # 4. Severity & Response Time Level
    if risk > 85:
        severity = "critical"
        response_time = "immediate"
    elif risk > 70:
        severity = "high"
        response_time = "within 2 minutes"
    else:
        severity = "moderate"
        response_time = "within 2 minutes"

    # 5. Action, Priority, and Team Assignment Rules
    rules = {
        "fire": {
            "action": "evacuate immediately",
            "priority": "critical"
        },
        "panic": {
            "action": "evacuate and control crowd",
            "priority": "high"
        },
        "medical": {
            "action": "notify nearest responder",
            "priority": "medium"
        },
        "normal": {
            "action": "monitor",
            "priority": "low"
        }
    }

    decision = rules.get(final_type, {"action": "monitor", "priority": "low"})

    # Team Assignment
    assigned_team = "all_staff"
    if final_type == "fire":
        assigned_team = "fire_response_team"
    elif final_type == "medical":
        assigned_team = "medical_team"
    elif final_type == "panic":
        assigned_team = "crowd_control_team"

    # 6. Action Confidence
    action_confidence = round(confidence * (risk / 100.0), 2)

    return {
        "type": final_type,
        "severity": severity,
        "confidence": round(confidence, 2),
        "risk": int(risk),
        "action": decision["action"],
        "assigned_team": assigned_team,
        "zone": zone,
        "priority": decision["priority"],
        "recommended_response_time": response_time,
        "action_confidence": action_confidence,
        "prediction": prediction,
        "explanation": " ".join(explanation_parts),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
