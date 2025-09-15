# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Baggateria is a QR code-based menu system for a coffee shop, built with React + Vite and Supabase as the backend. The application displays menu items filtered by location, supports favorites functionality, and features a mobile-first responsive design.

## Common Commands

```bash
# Development
npm run dev          # Start development server (Vite)

# Build and Production
npm run build        # Build for production
npm run preview      # Preview production build locally

# Code Quality
npm run lint         # Run ESLint
```

## Architecture

### Core Structure
- **Single-page application** with two main views: menu and favorites
- **Location-based filtering**: Menu items filtered by selected location from URL params
- **Real-time data**: Polls Supabase every 60 seconds for menu updates
- **Local storage**: Favorites persisted in browser localStorage
- **Mobile-first design** with bottom sheet modals and touch interactions

### Key Components
- `App.jsx`: Main application component with all business logic
- `BottomSheet`: Mobile-friendly modal for item details with swipe-to-close
- `FavoritesTextList`: Dedicated favorites view component

### Data Flow
1. **Data Loading**: Fetches menu items from Supabase `menu` table
2. **Location Management**: Uses URL query params (`?loc=`) with transliteration for Russian locations
3. **Favorites**: Stored as JSON in localStorage with unique keys based on item ID and selected options
4. **Real-time Updates**: Automatic polling ensures menu stays current

### State Management
All state managed with React hooks in the main App component:
- `items`: All menu items from Supabase
- `location`: Current selected location (from URL)
- `favorites`: Array of favorited items with options
- `modalItem`: Currently viewed item in bottom sheet
- `selectedOpts`: Selected options for current modal item

## Environment Configuration

Required environment variables (see `.env`):
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON`: Supabase anonymous key

## Database Schema

Supabase `menu` table structure:
- `id`: Primary key
- `name`: Item name
- `category`: Menu category
- `description`: Item description
- `ingredients`: Item ingredients list
- `size`: Size/portion info
- `price`: Base price (number)
- `photo`: Image URL (Supabase Storage)
- `options`: Comma-separated options with prices ("Option:+50, Extra:+100")
- `location`: Comma-separated locations ("Депо, Арбат")
- `available`: Boolean availability flag
- `updated_at`: Last modified timestamp

## Styling and Design

- **Framework**: Tailwind CSS v4 with custom CSS variables
- **Color Scheme**: Coffee shop theme with soft browns (#463223) and cream colors
- **Typography**: Montserrat font family throughout
- **Mobile-First**: Responsive design optimized for mobile devices
- **Touch Interactions**: Swipe gestures, smooth scrolling, and haptic feedback

## Key Features

### Location-Based Menu
- URL-based location selection with transliteration
- Automatic filtering of menu items by location
- Persistent location selection across page reloads

### Favorites System
- Add/remove items with specific option combinations
- Local storage persistence
- Dedicated favorites view with expandable options
- Floating action button with badge counter

### Image Handling
- Supabase Storage integration
- Fallback placeholder SVGs for failed image loads
- Optimized loading with lazy loading and proper error handling

### Mobile UX
- Bottom sheet modals with swipe-to-dismiss
- Smooth category scrolling with intersection observer
- Touch-optimized buttons and interactions
- Sticky headers and category navigation

## Development Notes

- **No TypeScript**: Project uses JavaScript with JSX
- **No Router**: Single-page app with view state management
- **Polling Strategy**: 60-second intervals for data freshness
- **Error Handling**: Console logging with graceful degradation
- **Performance**: Memoized calculations and intersection observers for scroll performance