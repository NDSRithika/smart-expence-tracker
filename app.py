# -*- coding: utf-8 -*-
"""
Ledger Smart Expense Tracker - Python Flask & SQLite Backend
-----------------------------------------------------------
This file handles user session authentication, SQLite database operations,
expense CRUD logic, custom category creation, and smart financial analysis.
"""

import os
import sqlite3
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = "ledger_secret_key_for_session_management_2026"
app.config.update(
    SESSION_COOKIE_SAMESITE="None",
    SESSION_COOKIE_SECURE=True
)
DATABASE = "database.db"

# ================= DATABASE INITIALIZATION =================

def get_db_connection():
    """Establishes and returns a database connection with dict-like row factory."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Creates tables if they do not exist and seeds initial categories."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Users Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            monthly_budget REAL DEFAULT 0,
            monthly_salary REAL DEFAULT 0,
            savings_goal REAL DEFAULT 0
        )
    """)
    
    # 2. Categories Table (allows default categories and user custom categories)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            name TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            UNIQUE(user_id, name)
        )
    """)
    
    # 3. Expenses Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            date TEXT NOT NULL,
            description TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    """)
    
    conn.commit()
    
    # Run migrations for existing users if columns are missing
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN monthly_salary REAL DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN savings_goal REAL DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    conn.commit()
    conn.close()
    print("SQLite database initialized successfully.")

# Execute DB initialization
init_db()

def ensure_user_categories(user_id):
    """Ensures that all default professional categories exist for the user."""
    conn = get_db_connection()
    cursor = conn.cursor()
    categories = [
        "Rent", "House Rent", "EMI", "Groceries", "Vegetables", "Fruits", "Milk",
        "Electricity Bill", "Water Bill", "Internet", "Mobile Recharge", "Petrol",
        "Public Transport", "Cab", "Shopping", "Clothing", "Medical", "Insurance",
        "Education", "Entertainment", "Restaurant", "Coffee", "Snacks", "Gym",
        "Subscription", "Investment", "Family", "Gifts", "Travel", "Emergency", "Other"
    ]
    for cat in categories:
        cursor.execute(
            "INSERT OR IGNORE INTO categories (user_id, name) VALUES (?, ?)",
            (user_id, cat)
        )
    conn.commit()
    conn.close()

# ================= AUTHENTICATION MIDDLEWARE =================

def get_current_user():
    """Helper to check if a user is logged in and return their ID."""
    return session.get("user_id")

# ================= PAGE ROUTING (HTML TEMPLATES) =================

@app.route("/")
def index():
    """Redirects to dashboard if logged in, otherwise to login page."""
    if get_current_user():
        return redirect(url_for("dashboard"))
    return redirect(url_for("login"))

@app.route("/login", methods=["GET", "POST"])
def login():
    """Handles user login."""
    print(f"--- Login request --- Method: {request.method}", flush=True)
    if get_current_user():
        print("User already logged in, redirecting to dashboard.", flush=True)
        return redirect(url_for("dashboard"))
        
    error = None
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        print(f"POST parameters - Username: '{username}', Password length: {len(password)}", flush=True)
        
        if not username or not password:
            error = "Both username and password are required."
            print(f"Login failed: {error}", flush=True)
        else:
            conn = get_db_connection()
            user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
            conn.close()
            
            if user:
                print(f"User found in database: ID {user['id']}, Username '{user['username']}'", flush=True)
                password_check = check_password_hash(user["password"], password)
                print(f"Password hash check result: {password_check}", flush=True)
                
                if password_check:
                    session["user_id"] = user["id"]
                    session["username"] = user["username"]
                    print(f"Session created successfully for user_id={session['user_id']}. Redirecting to dashboard.", flush=True)
                    return redirect(url_for("dashboard"))
                else:
                    error = "Invalid email or password"
                    print("Login failed: Password hash verification failed.", flush=True)
            else:
                error = "Invalid email or password"
                print(f"Login failed: Username '{username}' not found in database.", flush=True)
                
    return render_template("login.html", error=error)

@app.route("/register", methods=["GET", "POST"])
def register():
    """Handles user registration."""
    if get_current_user():
        return redirect(url_for("dashboard"))
        
    error = None
    success = None
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        confirm_password = request.form.get("confirm_password", "")
        
        if not username or not password or not confirm_password:
            error = "All fields are required."
        elif len(username) < 3:
            error = "Username must be at least 3 characters long."
        elif len(password) < 6:
            error = "Password must be at least 6 characters long."
        elif password != confirm_password:
            error = "Passwords do not match."
        else:
            hashed_password = generate_password_hash(password)
            conn = get_db_connection()
            try:
                # Insert User
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO users (username, password, monthly_budget) VALUES (?, ?, ?)",
                    (username, hashed_password, 0)
                )
                user_id = cursor.lastrowid
                conn.commit()
                conn.close()
                
                # Seed default categories for the new user
                ensure_user_categories(user_id)
                
                success = "Account created successfully! Please log in."
            except sqlite3.IntegrityError:
                error = f"Username '{username}' is already taken."
                if 'conn' in locals() and conn:
                    conn.close()
                
    return render_template("register.html", error=error, success=success)

@app.route("/logout")
def logout():
    """Logs out the user and clears session data."""
    session.clear()
    return redirect(url_for("login"))

@app.route("/dashboard")
def dashboard():
    """Renders the primary smart dashboard view."""
    user_id = get_current_user()
    if not user_id:
        return redirect(url_for("login"))
    return render_template("dashboard.html", username=session.get("username"))

@app.route("/expenses")
def expenses_page():
    """Renders the list and filter interface for expenses."""
    user_id = get_current_user()
    if not user_id:
        return redirect(url_for("login"))
    return render_template("expenses.html", username=session.get("username"))

def calculate_budget_health_score(salary, savings_goal, monthly_spent):
    if salary <= 0:
        return 100, "Excellent", ["Set up your Monthly Salary and Savings Goal to get a personalized score."]
    
    # Available budget
    budget = salary - savings_goal
    if budget <= 0:
        return 50, "Needs Improvement", ["Your Savings Goal is too close to or exceeds your Salary. Consider lowering your goal to have an achievable spending budget."]
        
    score = 100
    tips = []
    
    # Factor 1: Over-spending available budget
    utilization = monthly_spent / budget
    if utilization > 1.0:
        over_pct = (utilization - 1.0) * 100
        deduction = min(50, over_pct * 1.5)
        score -= deduction
        tips.append(f"You have exceeded your available budget by {over_pct:.0f}%. Try cutting back on non-essential categories.")
    elif utilization > 0.8:
        score -= 15
        tips.append("You have used over 80% of your available budget. Keep an eye on minor expenses to avoid going over.")
    elif utilization > 0.5:
        score -= 5
        tips.append("You've spent more than half of your budget. You are on track, but stay mindful of discretionary spending.")
    else:
        tips.append("Excellent budget utilization! You've spent less than 50% of your available budget so far.")
        
    # Factor 2: Savings Goal achievement
    expected_savings = salary - monthly_spent
    if expected_savings < savings_goal:
        shortfall = savings_goal - expected_savings
        shortfall_pct = (shortfall / savings_goal) * 100
        deduction = min(40, shortfall_pct * 0.8)
        score -= deduction
        tips.append(f"Expected savings (₹{expected_savings:,.0f}) is below your goal (₹{savings_goal:,.0f}). Reduce spending by ₹{shortfall:,.0f} to catch up.")
    else:
        tips.append("Great job! You are currently on track to meet or exceed your monthly savings goal.")
        
    score = max(0, min(100, int(score)))
    
    if score >= 95:
        rating = "Excellent"
    elif score >= 80:
        rating = "Good"
    elif score >= 60:
        rating = "Average"
    else:
        rating = "Needs Improvement"
        
    if not tips:
        tips = ["Track your daily expenses diligently.", "Allocate 20% of your salary directly to savings at the start of the month."]
        
    return score, rating, tips

# ================= API ENDPOINTS (FOR AJAX CALLS & CHART.JS) =================

@app.route("/api/summary", methods=["GET"])
def api_summary():
    """Retrieves financial summaries and smart suggestions for the current month."""
    user_id = get_current_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # Auto ensure the user has all new categories
    ensure_user_categories(user_id)

    conn = get_db_connection()
    
    # 1. Fetch user budget, salary, and savings goal
    user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    monthly_budget = user["monthly_budget"] if user else 0.0
    monthly_salary = user["monthly_salary"] if user else 0.0
    savings_goal = user["savings_goal"] if user else 0.0
    
    # Get current year-month (e.g., "2026-07")
    current_month_str = datetime.now().strftime("%Y-%m")
    current_day_of_month = datetime.now().day
    
    # 2. Total expenses (All Time)
    total_all_time = conn.execute(
        "SELECT SUM(amount) as total FROM expenses WHERE user_id = ?",
        (user_id,)
    ).fetchone()["total"] or 0.0
    
    # 3. Total transactions (All Time)
    total_tx = conn.execute(
        "SELECT COUNT(id) as count FROM expenses WHERE user_id = ?",
        (user_id,)
    ).fetchone()["count"] or 0
    
    # 4. Monthly spent
    monthly_spent = conn.execute(
        "SELECT SUM(amount) as total FROM expenses WHERE user_id = ? AND date LIKE ?",
        (user_id, f"{current_month_str}%")
    ).fetchone()["total"] or 0.0
    
    # 5. Highest expense (This Month, fallback to All Time)
    highest_expense_row = conn.execute(
        "SELECT * FROM expenses WHERE user_id = ? AND date LIKE ? ORDER BY amount DESC LIMIT 1",
        (user_id, f"{current_month_str}%")
    ).fetchone()
    if not highest_expense_row:
        highest_expense_row = conn.execute(
            "SELECT * FROM expenses WHERE user_id = ? ORDER BY amount DESC LIMIT 1",
            (user_id,)
        ).fetchone()
        
    highest_expense = highest_expense_row["amount"] if highest_expense_row else 0.0
    highest_expense_title = highest_expense_row["name"] if highest_expense_row else "N/A"
    
    # 6. Latest 5 expenses
    latest_rows = conn.execute(
        "SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 5",
        (user_id,)
    ).fetchall()
    latest_expenses = [dict(row) for row in latest_rows]
    
    # 7. Category breakdown (for the current month)
    cat_rows = conn.execute("""
        SELECT category, SUM(amount) as total 
        FROM expenses 
        WHERE user_id = ? AND date LIKE ? 
        GROUP BY category
        ORDER BY total DESC
    """, (user_id, f"{current_month_str}%")).fetchall()
    category_breakdown = {row["category"]: row["total"] for row in cat_rows}
    
    top_spending_category = cat_rows[0]["category"] if len(cat_rows) > 0 else "N/A"
    least_spending_category = cat_rows[-1]["category"] if len(cat_rows) > 0 else "N/A"

    # 8. User categories list
    categories_rows = conn.execute("SELECT name FROM categories WHERE user_id = ? ORDER BY name ASC", (user_id,)).fetchall()
    user_categories = [row["name"] for row in categories_rows]

    # Substring date group-by for monthly averages
    historical_rows = conn.execute("""
        SELECT substr(date, 1, 7) as month, SUM(amount) as total
        FROM expenses
        WHERE user_id = ?
        GROUP BY month
    """, (user_id,)).fetchall()
    
    if len(historical_rows) > 0:
        average_monthly_expense = sum(row["total"] for row in historical_rows) / len(historical_rows)
    else:
        average_monthly_expense = monthly_spent
        
    conn.close()

    # Remaining calculations
    remaining_budget = monthly_budget - monthly_spent
    budget_used_percent = (monthly_spent / monthly_budget * 100) if monthly_budget > 0 else 0.0
    expected_savings = monthly_salary - monthly_spent
    
    average_daily_expense = monthly_spent / current_day_of_month
    average_weekly_expense = average_daily_expense * 7

    # Calculate Budget Health Score & Rating & Tips
    score, rating, health_tips = calculate_budget_health_score(monthly_salary, savings_goal, monthly_spent)

    # 9. Smart Suggestions Generation (Rule-Based & Comparative Analysis)
    suggestions = []
    
    # Get last month year-string
    import datetime as dt
    now = datetime.now()
    first_of_this_month = now.replace(day=1)
    last_month_dt = first_of_this_month - dt.timedelta(days=1)
    last_month_str = last_month_dt.strftime("%Y-%m")
    
    # Query last month's category spending for comparison
    conn_compare = get_db_connection()
    last_cat_rows = conn_compare.execute("""
        SELECT category, SUM(amount) as total 
        FROM expenses 
        WHERE user_id = ? AND date LIKE ? 
        GROUP BY category
    """, (user_id, f"{last_month_str}%")).fetchall()
    last_category_breakdown = {row["category"]: row["total"] for row in last_cat_rows}
    conn_compare.close()

    if monthly_salary == 0 and savings_goal == 0:
        suggestions.append({
            "type": "info",
            "message": "Welcome to your Smart Personal Finance Advisor! Please configure your Monthly Income and Savings Goal to unlock budget health scoring, prediction models, and category-level analysis."
        })
    else:
        # Check 1: Budget Exceeded or Close
        if monthly_spent > monthly_budget:
            suggestions.append({
                "type": "error",
                "message": f"Warning! You exceeded your spending budget of ₹{monthly_budget:,.2f} by ₹{abs(remaining_budget):,.2f}."
            })
        elif budget_used_percent >= 90:
            suggestions.append({
                "type": "warning",
                "message": f"Alert: You have used {budget_used_percent:.0f}% of your available budget. Only ₹{remaining_budget:,.2f} remains!"
            })
        elif budget_used_percent >= 75:
            suggestions.append({
                "type": "warning",
                "message": f"Be careful! You spent {budget_used_percent:.0f}% of your budget. Try to limit non-essential purchases."
            })
        else:
            suggestions.append({
                "type": "success",
                "message": f"Excellent! You are staying within your budget. You have ₹{remaining_budget:,.2f} remaining."
            })

        # Check 2: Restaurant spending
        restaurant_spend = category_breakdown.get("Restaurant", 0.0)
        if restaurant_spend > 0:
            cooking_savings = restaurant_spend * 0.25
            suggestions.append({
                "type": "info",
                "message": f"You spent ₹{restaurant_spend:,.2f} on Restaurants this month. Try cooking at home 2–3 days a week to save approximately ₹{cooking_savings:,.2f}."
            })
            
        # Check 3: Shopping comparison
        shopping_spend = category_breakdown.get("Shopping", 0.0)
        last_shopping_spend = last_category_breakdown.get("Shopping", 0.0)
        if shopping_spend > 0 and last_shopping_spend > 0:
            increase_pct = ((shopping_spend - last_shopping_spend) / last_shopping_spend) * 100
            if increase_pct > 10:
                suggestions.append({
                    "type": "warning",
                    "message": f"Shopping expenses are {increase_pct:.0f}% higher than last month."
                })
                
        # Check 4: Petrol/Travel costs
        petrol_spend = category_breakdown.get("Petrol", 0.0) + category_breakdown.get("Petrol/Travel", 0.0)
        if petrol_spend > 3000:
            suggestions.append({
                "type": "info",
                "message": "Your petrol expenses are very high. Consider public transport or carpooling."
            })
            
        # Check 5: Subscriptions
        subscription_spend = category_breakdown.get("Subscription", 0.0)
        if subscription_spend > 1500:
            suggestions.append({
                "type": "warning",
                "message": "You are spending too much on subscriptions. Consider cancelling unused subscriptions."
            })
            
        # Check 6: Medical expenses
        medical_spend = category_breakdown.get("Medical", 0.0)
        last_medical_spend = last_category_breakdown.get("Medical", 0.0)
        if medical_spend > last_medical_spend and last_medical_spend > 0:
            suggestions.append({
                "type": "info",
                "message": "Medical expenses increased this month."
            })
            
        # Check 7: Groceries efficiency
        groceries_spend = category_breakdown.get("Groceries", 0.0) + category_breakdown.get("Grocery", 0.0)
        if groceries_spend > 0 and groceries_spend < (monthly_salary * 0.15):
            suggestions.append({
                "type": "success",
                "message": "You are managing groceries efficiently."
            })

        # Check 8: Shopping as % of income
        if shopping_spend > 0:
            shop_ratio = (shopping_spend / monthly_salary) * 100
            if shop_ratio > 15:
                suggestions.append({
                    "type": "info",
                    "message": f"You are spending {shop_ratio:.0f}% of your income on shopping."
                })
                
        # Check 9: Food expenses higher than recommended (25%)
        total_food_spend = groceries_spend + restaurant_spend + category_breakdown.get("Coffee", 0.0) + category_breakdown.get("Snacks", 0.0)
        if total_food_spend > (monthly_salary * 0.25):
            suggestions.append({
                "type": "warning",
                "message": "Food expenses are higher than recommended."
            })
            
        # Check 10: Savings percentage
        if savings_goal > 0:
            savings_pct = (savings_goal / monthly_salary) * 100
            if savings_pct < 20:
                suggestions.append({
                    "type": "info",
                    "message": f"You are saving only {savings_pct:.0f}% of your income. Financial experts often recommend aiming for at least 20% when possible."
                })

    # 10. Savings Prediction & Targeted Reduction Suggestions
    savings_prediction_msg = ""
    reduction_suggestions = []
    if monthly_salary > 0:
        if expected_savings < savings_goal:
            shortfall = savings_goal - expected_savings
            savings_prediction_msg = f"You need to reduce spending by ₹{shortfall:,.2f} to achieve your monthly savings goal."
            
            # Identify discretionary category spending for current month
            discretionary_spend = []
            discretionary_names = [
                "Restaurant", "Coffee", "Snacks", "Shopping", "Clothing", "Entertainment", "Gifts", "Travel", "Cab", "Other"
            ]
            for cat_name in discretionary_names:
                spend = category_breakdown.get(cat_name, 0.0)
                if spend > 0:
                    discretionary_spend.append({"category": cat_name, "amount": spend})
            
            # Sort by spend descending and take top 3
            discretionary_spend.sort(key=lambda x: x["amount"], reverse=True)
            top3_discretionary = discretionary_spend[:3]
            
            total_top3_spend = sum(x["amount"] for x in top3_discretionary)
            if total_top3_spend > 0:
                for item in top3_discretionary:
                    cat_pct = item["amount"] / total_top3_spend
                    suggested_reduction = min(item["amount"], shortfall * cat_pct)
                    reduction_suggestions.append({
                        "category": item["category"],
                        "reduction": suggested_reduction
                    })

    return jsonify({
        "monthlySalary": monthly_salary,
        "savingsGoal": savings_goal,
        "monthlyBudget": monthly_budget,
        "totalExpenses": total_all_time,
        "remainingBudget": remaining_budget,
        "budgetUsedPercent": budget_used_percent,
        "totalTransactions": total_tx,
        "monthlySpent": monthly_spent,
        "highestExpense": highest_expense,
        "highestExpenseTitle": highest_expense_title,
        "latestExpenses": latest_expenses,
        "suggestions": suggestions,
        "categories": user_categories,
        "expectedSavings": expected_savings,
        "budgetHealthScore": score,
        "budgetHealthRating": rating,
        "budgetHealthTips": health_tips,
        "topSpendingCategory": top_spending_category,
        "leastSpendingCategory": least_spending_category,
        "averageDailyExpense": average_daily_expense,
        "averageWeeklyExpense": average_weekly_expense,
        "averageMonthlyExpense": average_monthly_expense,
        "savingsPredictionMsg": savings_prediction_msg,
        "reductionSuggestions": reduction_suggestions
    })

@app.route("/api/expenses", methods=["GET", "POST"])
def api_expenses():
    """Handles listing expenses (GET) and creating new ones (POST)."""
    user_id = get_current_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db_connection()

    if request.method == "POST":
        data = request.json or {}
        name = data.get("name", "").strip()
        amount_raw = data.get("amount")
        category = data.get("category", "").strip()
        date = data.get("date", "").strip()
        description = data.get("description", "").strip()

        # Validations
        if not name:
            return jsonify({"error": "Expense name is required."}), 400
        try:
            amount = float(amount_raw)
            if amount <= 0:
                return jsonify({"error": "Amount must be positive."}), 400
        except (TypeError, ValueError):
            return jsonify({"error": "Valid positive number amount is required."}), 400
            
        if not category:
            return jsonify({"error": "Category is required."}), 400
        if not date:
            return jsonify({"error": "Date is required."}), 400

        conn.execute("""
            INSERT INTO expenses (user_id, name, amount, category, date, description)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (user_id, name, amount, category, date, description))
        conn.commit()
        conn.close()
        return jsonify({"message": "Expense added successfully."}), 201

    # GET REQUEST - Retrieve all expenses for listing with filters/sorting
    # Let script.js handle query parameters
    category_filter = request.args.get("category", "")
    month_filter = request.args.get("month", "") # "YYYY-MM"
    search_query = request.args.get("search", "")
    sort_by = request.args.get("sort", "date_desc")

    query = "SELECT * FROM expenses WHERE user_id = ?"
    params = [user_id]

    if category_filter and category_filter != "All":
        query += " AND category = ?"
        params.append(category_filter)

    if month_filter:
        query += " AND date LIKE ?"
        params.append(f"{month_filter}%")

    if search_query:
        query += " AND (name LIKE ? OR description LIKE ?)"
        params.append(f"%{search_query}%")
        params.append(f"%{search_query}%")

    # Dynamic sorting mapping
    if sort_by == "date_asc":
        query += " ORDER BY date ASC, id ASC"
    elif sort_by == "amount_desc":
        query += " ORDER BY amount DESC"
    elif sort_by == "amount_asc":
        query += " ORDER BY amount ASC"
    else:  # default date_desc
        query += " ORDER BY date DESC, id DESC"

    rows = conn.execute(query, params).fetchall()
    expenses_list = [dict(row) for row in rows]
    conn.close()

    return jsonify({"expenses": expenses_list})

@app.route("/api/expenses/<int:expense_id>", methods=["PUT", "DELETE"])
def api_expense_detail(expense_id):
    """Handles updating (PUT) and deleting (DELETE) individual expenses."""
    user_id = get_current_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db_connection()
    
    # Verify owner
    expense = conn.execute("SELECT * FROM expenses WHERE id = ? AND user_id = ?", (expense_id, user_id)).fetchone()
    if not expense:
        conn.close()
        return jsonify({"error": "Expense not found or unauthorized."}), 404

    if request.method == "DELETE":
        conn.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Expense deleted successfully."})

    if request.method == "PUT":
        data = request.json or {}
        name = data.get("name", "").strip()
        amount_raw = data.get("amount")
        category = data.get("category", "").strip()
        date = data.get("date", "").strip()
        description = data.get("description", "").strip()

        # Validations
        if not name:
            return jsonify({"error": "Expense name is required."}), 400
        try:
            amount = float(amount_raw)
            if amount <= 0:
                return jsonify({"error": "Amount must be positive."}), 400
        except (TypeError, ValueError):
            return jsonify({"error": "Valid positive number amount is required."}), 400
            
        if not category:
            return jsonify({"error": "Category is required."}), 400
        if not date:
            return jsonify({"error": "Date is required."}), 400

        conn.execute("""
            UPDATE expenses 
            SET name = ?, amount = ?, category = ?, date = ?, description = ?
            WHERE id = ?
        """, (name, amount, category, date, description, expense_id))
        conn.commit()
        conn.close()
        return jsonify({"message": "Expense updated successfully."})

@app.route("/api/budget", methods=["POST"])
def api_update_budget():
    """Updates the monthly salary, savings goal, and calculated budget limit for the logged-in user."""
    user_id = get_current_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json or {}
    
    # Check if we got modern smart settings inputs
    salary_raw = data.get("monthly_salary")
    savings_raw = data.get("savings_goal")
    
    conn = get_db_connection()
    
    if salary_raw is not None or savings_raw is not None:
        try:
            salary = float(salary_raw) if salary_raw is not None else 0.0
            savings = float(savings_raw) if savings_raw is not None else 0.0
            if salary < 0 or savings < 0:
                return jsonify({"error": "Salary and savings goal cannot be negative."}), 400
        except (TypeError, ValueError):
            return jsonify({"error": "Valid salary and savings goal values are required."}), 400
            
        # Available Spending Budget = Monthly Salary - Savings Goal
        budget = max(0.0, salary - savings)
        conn.execute(
            "UPDATE users SET monthly_salary = ?, savings_goal = ?, monthly_budget = ? WHERE id = ?",
            (salary, savings, budget, user_id)
        )
        conn.commit()
        conn.close()
        return jsonify({
            "message": "Financial settings updated successfully.",
            "monthly_salary": salary,
            "savings_goal": savings,
            "monthly_budget": budget
        })
    else:
        # Backward compatibility for direct budget updates
        budget_raw = data.get("monthly_budget")
        try:
            budget = float(budget_raw)
            if budget < 0:
                return jsonify({"error": "Budget cannot be negative."}), 400
        except (TypeError, ValueError):
            return jsonify({"error": "Valid budget amount is required."}), 400

        conn.execute("UPDATE users SET monthly_budget = ? WHERE id = ?", (budget, user_id))
        conn.commit()
        conn.close()
        return jsonify({"message": "Monthly budget updated successfully.", "monthly_budget": budget})

@app.route("/api/categories", methods=["GET", "POST"])
def api_categories():
    """Handles getting (GET) and creating (POST) custom categories for the user."""
    user_id = get_current_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db_connection()

    if request.method == "POST":
        data = request.json or {}
        name = data.get("name", "").strip()

        if not name:
            return jsonify({"error": "Category name is required."}), 400
        if len(name) > 30:
            return jsonify({"error": "Category name is too long."}), 400

        try:
            conn.execute("INSERT INTO categories (user_id, name) VALUES (?, ?)", (user_id, name))
            conn.commit()
            conn.close()
            return jsonify({"message": f"Category '{name}' created successfully.", "name": name}), 201
        except sqlite3.IntegrityError:
            conn.close()
            return jsonify({"error": f"Category '{name}' already exists."}), 400

    rows = conn.execute("SELECT name FROM categories WHERE user_id = ? ORDER BY name ASC", (user_id,)).fetchall()
    categories_list = [row["name"] for row in rows]
    conn.close()
    return jsonify({"categories": categories_list})

@app.route("/api/charts/monthly-trends", methods=["GET"])
def api_charts_monthly():
    """Aggregates spending data over all months for historical bar/line comparison."""
    user_id = get_current_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db_connection()
    rows = conn.execute("""
        SELECT substr(date, 1, 7) as month, SUM(amount) as total
        FROM expenses
        WHERE user_id = ?
        GROUP BY month
        ORDER BY month ASC
    """, (user_id,)).fetchall()
    conn.close()

    months = []
    totals = []
    for row in rows:
        months.append(row["month"])
        totals.append(row["total"])

    return jsonify({"months": months, "totals": totals})

@app.route("/api/charts/daily-trends", methods=["GET"])
def api_charts_daily():
    """Aggregates spending day-by-day for a specified month to generate line charts."""
    user_id = get_current_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    month_filter = request.args.get("month", "") # "YYYY-MM"
    if not month_filter:
        month_filter = datetime.now().strftime("%Y-%m")

    conn = get_db_connection()
    rows = conn.execute("""
        SELECT date, SUM(amount) as total
        FROM expenses
        WHERE user_id = ? AND date LIKE ?
        GROUP BY date
        ORDER BY date ASC
    """, (user_id, f"{month_filter}%")).fetchall()
    conn.close()

    dates = []
    totals = []
    cumulative = []
    running_total = 0.0

    for row in rows:
        dates.append(row["date"])
        totals.append(row["total"])
        running_total += row["total"]
        cumulative.append(running_total)

    return jsonify({
        "month": month_filter,
        "dates": dates,
        "dailyTotals": totals,
        "cumulativeTotals": cumulative
    })

# ================= RUN SERVER =================

if __name__ == "__main__":
    # Ensure database is configured before launching the Flask server.
    app.run(host="0.0.0.0", port=3000, debug=True)
