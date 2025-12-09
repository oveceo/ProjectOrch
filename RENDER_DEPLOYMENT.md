# Render Deployment Guide

This project is configured for easy deployment to Render.

## Quick Deploy

1. Push code to GitHub
2. Create account at https://render.com
3. Connect your GitHub repository
4. Render will auto-detect configuration from `render.yaml`
5. Add Smartsheet environment variables manually

## Environment Variables

Required environment variables (add in Render dashboard):

```
SMARTSHEET_ACCESS_TOKEN=your_token_here
SMARTSHEET_PORTFOLIO_SHEET_ID=6732698911461252
SMARTSHEET_WBS_TEMPLATE_SHEET_ID=2074433216794500
SMARTSHEET_WBS_FOLDER_ID=4414766191011716
```

## Post-Deployment

After first deployment, run database migrations:

1. Open Shell in Render dashboard
2. Run: `npx prisma db push`

## Your App URL

After deployment, your app will be available at:
https://transmission-wbs-app.onrender.com

Update the link in your Transmission Hub HTML to point to this URL.

