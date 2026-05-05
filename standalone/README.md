# "Is Your Website Fucked?" Landing Page

Bold, provocative landing page designed for billboard/outdoor advertising campaigns.

## 📁 Files

- **is-your-website-fucked.html** - Main HTML structure
- **is-your-website-fucked.css** - All styles and design
- **is-your-website-fucked.js** - Form handling and interactions

## 🚀 Quick Start

1. Open `is-your-website-fucked.html` in your browser
2. Customize the form endpoint in `is-your-website-fucked.js` (line 13)
3. Edit colors, fonts, and spacing in `is-your-website-fucked.css`

## 🎨 Easy Customization

### Change Colors

Open `is-your-website-fucked.css` and edit the CSS variables at the top:

```css
:root {
    --color-bg: #000000;           /* Background (currently black) */
    --color-text: #ffffff;         /* Text color (currently white) */
    --color-accent: #FF0000;       /* CTA buttons and accents (currently red) */
    --color-accent-hover: #CC0000; /* Button hover state */
}
```

**Color scheme ideas:**
- **Red (current)**: Aggressive, urgent, attention-grabbing
- **Yellow (#FFD700)**: High visibility, optimistic, works great on black
- **Electric blue (#00D4FF)**: Modern, tech-forward
- **Neon green (#39FF14)**: Edgy, cyberpunk aesthetic

### Edit the List

In `is-your-website-fucked.html`, find the `<ul class="fucked-list">` section and:
- **Add items**: Copy a `<li>` and paste, then edit the text
- **Remove items**: Delete the entire `<li>` tag
- **Reorder**: Cut and paste `<li>` items to change order

**Writing tips for list items:**
- Mix technical problems with business pain
- Use specifics (dates, numbers, real examples)
- Keep the tone smart and witty, not crude
- End strong - save your best ones for the bottom

### Change Typography

**Font weight** (how bold the text is):
```css
:root {
    --font-weight-normal: 400;  /* Body text */
    --font-weight-medium: 500;  /* Slightly emphasized */
    --font-weight-bold: 700;    /* Bold text */
    --font-weight-black: 900;   /* Extra bold headlines */
}
```

**Use a different font:**

1. Find a font on Google Fonts (fonts.google.com)
2. Replace the `<link>` tag in the HTML `<head>`:

```html
<link href="https://fonts.googleapis.com/css2?family=YOUR_FONT:wght@400;500;700;900&display=swap" rel="stylesheet">
```

3. Update the CSS variable:

```css
:root {
    --font-main: 'YOUR_FONT', sans-serif;
}
```

**Font recommendations:**
- **Inter** (current): Clean, professional, excellent readability
- **Space Grotesk**: Geometric, slightly edgy
- **Work Sans**: Friendly but serious
- **Manrope**: Modern, rounded
- **DM Sans**: Tech-forward, startup vibes

### Adjust Spacing

```css
:root {
    --spacing-xs: 0.5rem;  /* Tiny gaps */
    --spacing-sm: 1rem;    /* Small gaps */
    --spacing-md: 2rem;    /* Medium gaps */
    --spacing-lg: 4rem;    /* Large sections */
    --spacing-xl: 6rem;    /* Huge sections */
}
```

Increase these values to make the page feel more open and spacious. Decrease to make it more compact.

## 📧 Form Setup

The form needs a backend to send emails. Three easy options:

### Option 1: FormSubmit (Easiest - Free)

1. Open `is-your-website-fucked.js`
2. Line 13, change:

```javascript
formEndpoint: 'https://formsubmit.co/your@email.com', // Replace with your email
```

3. Done. Form submissions will email you.

### Option 2: Formspree

1. Sign up at formspree.io
2. Create a form, get your endpoint
3. Update line 13 in the JS file with your endpoint

### Option 3: Your Own Backend

Replace the fetch call with your API endpoint.

## 📊 Analytics & Tracking

### Google Analytics

Add this before the closing `</head>` tag in the HTML:

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

Then uncomment the tracking code in `is-your-website-fucked.js` (lines 85-110).

### Facebook Pixel

Add before closing `</head>`:

```html
<!-- Facebook Pixel -->
<script>
  !function(f,b,e,v,n,t,s){...}
  fbq('init', 'YOUR_PIXEL_ID');
  fbq('track', 'PageView');
</script>
```

### Tracking Billboard Placements

**Method 1: Promo Codes**
- Put unique codes on each billboard: `unfuckyourweb.com - Use code DOWNTOWN15`
- Ask for the code in the form

**Method 2: Unique URLs**
- Use URL parameters: `unfuckyourweb.com?location=downtown`
- The JS already captures these automatically

**Method 3: QR Codes**
- Generate QR codes with tracking: `unfuckyourweb.com?src=billboard_5th_ave`
- Each location gets a unique code

## 🎯 Content Strategy

### Headline

Current: **"Is Your Website Fucked?"**

Alternative headlines (edit in HTML):
- "Your Website Is Costing You Money"
- "This Is Why Nobody Uses Your Website"
- "We Fix Fucked Websites"
- "Stop Pretending Your Website Is Fine"

### CTA Copy

Current: **"What are you going to do next, hire your cousin?"**

The cousin line is gold. Other options:
- "Still think you can fix this yourself?"
- "Want to keep losing customers to your competitors?"
- "Ready to stop making excuses?"

### Pricing Display

Current: **"Professional fixes starting at $497"**

Edit line 61 in the HTML. Consider:
- Remove price to qualify leads first (fewer, better leads)
- Show range: "$497 - $4,997 depending on how fucked it is"
- Multiple tiers: "Quick fixes $497 | Full rebuild $2,997"

## 🌐 Deployment

Deploy to:
- **Netlify**: Drag and drop the folder → netlify.com
- **Vercel**: Push to GitHub → import in vercel.com
- **Cloudflare Pages**: Connect GitHub repo
- **Any hosting**: Upload the 3 files via FTP

Set your domain to point to the deployed site.

## 📱 Mobile Optimization

Already fully responsive. Test by:
1. Resizing browser window
2. Using Chrome DevTools (F12 → Toggle Device Toolbar)
3. Checking on your actual phone

The design uses `clamp()` for fluid typography that scales perfectly from mobile to desktop.

## ♿ Accessibility

Built-in features:
- Semantic HTML structure
- Keyboard navigation support
- Focus states on all interactive elements
- Respects `prefers-reduced-motion` setting
- High contrast (white on black)

## 🔧 Advanced Customization

### Add More Sections

Copy any `<section>` block and paste it where you want a new section. Common additions:
- **Pricing table**: Show service tiers
- **Before/After gallery**: Show fixed sites
- **Testimonials**: Social proof from happy clients
- **FAQ**: Handle objections

### Change the List Style

Currently using red "×" marks. Edit in CSS (line 159):

```css
.fucked-list li:before {
    content: "×";        /* Change this character */
    color: var(--color-accent);
}
```

Try: `"•"`, `"—"`, `"→"`, `"!"`, `"⚠"`, `"💀"`

### Add Animation

Uncomment the scroll animation code in the JS (already included, lines 118-134). List items fade in as you scroll.

## 🐛 Troubleshooting

**Form not sending?**
- Check the endpoint URL in the JS file
- Check browser console (F12) for errors
- Make sure you changed the email address

**Styles look broken?**
- Make sure all 3 files are in the same folder
- Check that the CSS file is named correctly
- Clear browser cache (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)

**Mobile looks weird?**
- Make sure you have the viewport meta tag in HTML (line 5)
- Test in actual mobile browser, not just resized desktop

## 💡 Pro Tips

1. **Keep the list long** - The comedic length is part of the appeal. 30-50 items is perfect.

2. **Update the footer year** - Change "2025" to current year in the HTML.

3. **Test the form yourself** - Fill it out before launching to make sure emails arrive.

4. **A/B test headlines** - Try different versions on different billboards and track which converts better.

5. **Use real examples** - The more specific the list items, the funnier and more relatable.

6. **Don't soften the language too much** - The edge is the brand. Smart irreverence, not crude, but don't dilute it.

## 📈 Performance

- No framework bloat (vanilla JS)
- No external dependencies except Google Fonts
- Minimal CSS (under 5KB)
- Fast page load (under 1 second on decent connection)
- Perfect Lighthouse score achievable

## 🎨 Design Philosophy

**Why black background?**
- High contrast for outdoor visibility
- Sophisticated, not childish
- Makes red/yellow accents pop
- Easier to read on phones in bright light

**Why such big text?**
- Mobile-first (most billboard conversions happen on phones)
- Accessibility (easy to read for everyone)
- Impact (demands attention)

**Why the long list?**
- Pattern interrupt (unexpected format)
- Builds credibility through specificity
- Creates "I feel seen" moments for prospects
- Humorous without being a joke

## 📞 Support

Questions about customizing this page? Check the main website-builder skill documentation or the TPN reference implementation for more advanced features.

---

**Remember**: The provocative name gets attention. The long, specific list builds credibility. The challenging CTA closes the deal. Don't dilute the formula.
