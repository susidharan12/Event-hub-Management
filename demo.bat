@echo off
echo ========================================
echo EventHub Dashboard Demo
echo ========================================
echo.
echo 1. Backend API is running on http://localhost:3000
echo 2. Opening dashboard at http://localhost:3000/Public/organizer/pages/dashboard.html
echo.
echo Demo Steps:
echo 1. Fill all form fields (Title, Category, Date, Location, Price, Seats, Description)
echo 2. Upload a profile image (required)
echo 3. Click "Save Event" - buttons will become enabled
echo 4. Click "Preview" to see event preview
echo 5. Click "Create Event" to save to database
echo 6. Check "My Events" section to see the created event
echo 7. Dashboard count will update automatically
echo.
echo Opening browser...
start http://localhost:3000/Public/organizer/pages/dashboard.html
echo.
echo Demo ready! Follow the steps above to test the functionality.
pause