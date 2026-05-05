// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    // EDIT THIS: Replace with your form submission endpoint
    // Options:
    // 1. FormSubmit: 'https://formsubmit.co/your@email.com'
    // 2. Formspree: 'https://formspree.io/f/YOUR_FORM_ID'
    // 3. Your custom backend: 'https://yourapi.com/submit'
    formEndpoint: 'https://formsubmit.co/your@email.com', // CHANGE THIS

    // Success message shown after form submission
    successMessage: "Got it. We'll get back to you within 24 hours.",

    // Error message shown if submission fails
    errorMessage: 'Something went wrong. Try emailing us directly instead.'
};

// ============================================
// LIST SELECTION TRACKING
// ============================================

const selectedIssues = new Set();

document.addEventListener('DOMContentLoaded', function() {
    // Make list items selectable
    const listItems = document.querySelectorAll('.fucked-list li');

    listItems.forEach((item, index) => {
        item.addEventListener('click', function() {
            const itemText = this.textContent.trim();

            if (this.classList.contains('selected')) {
                this.classList.remove('selected');
                selectedIssues.delete(itemText);
            } else {
                this.classList.add('selected');
                selectedIssues.add(itemText);
            }
        });
    });
});

// ============================================
// FORM HANDLING
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('contactForm');
    const submitButton = form.querySelector('.submit-button');
    const buttonText = submitButton.querySelector('.button-text');
    const buttonLoader = submitButton.querySelector('.button-loader');
    const feedback = document.querySelector('.form-feedback');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Disable form while submitting
        submitButton.disabled = true;
        buttonText.style.display = 'none';
        buttonLoader.style.display = 'inline';
        feedback.style.display = 'none';

        // Get form data
        const formData = new FormData(form);

        // Add selected issues to form data
        if (selectedIssues.size > 0) {
            formData.append('selected_issues', Array.from(selectedIssues).join(' | '));
            formData.append('issues_count', selectedIssues.size);
        } else {
            formData.append('selected_issues', 'None selected');
            formData.append('issues_count', 0);
        }

        try {
            // Submit to configured endpoint
            const response = await fetch(CONFIG.formEndpoint, {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                // Success
                showFeedback('success', CONFIG.successMessage);
                form.reset();
            } else {
                // Server error
                throw new Error('Server returned an error');
            }
        } catch (error) {
            // Network or other error
            console.error('Form submission error:', error);
            showFeedback('error', CONFIG.errorMessage);
        } finally {
            // Re-enable form
            submitButton.disabled = false;
            buttonText.style.display = 'inline';
            buttonLoader.style.display = 'none';
        }
    });

    function showFeedback(type, message) {
        feedback.className = 'form-feedback ' + type;
        feedback.textContent = message;
        feedback.style.display = 'block';

        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                feedback.style.display = 'none';
            }, 5000);
        }
    }
});

// ============================================
// SMOOTH SCROLL FOR ANCHOR LINKS (REMOVED)
// ============================================

// Smooth scroll removed - using instant scroll instead
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');

        // Skip if it's just "#"
        if (targetId === '#') return;

        e.preventDefault();
        const target = document.querySelector(targetId);

        if (target) {
            target.scrollIntoView({
                behavior: 'auto',
                block: 'start'
            });
        }
    });
});

// ============================================
// ANALYTICS TRACKING (OPTIONAL)
// ============================================

// Track form submissions
function trackFormSubmission() {
    // Add your analytics tracking here
    // Example for Google Analytics:
    // gtag('event', 'form_submission', {
    //     'event_category': 'contact',
    //     'event_label': 'website_audit_request'
    // });

    // Example for Facebook Pixel:
    // fbq('track', 'Lead');

    console.log('Form submitted - add your analytics tracking in is-your-website-fucked.js');
}

// Track CTA button clicks
document.querySelectorAll('.cta-button').forEach(button => {
    button.addEventListener('click', function() {
        // Add your analytics tracking here
        // Example:
        // gtag('event', 'click', {
        //     'event_category': 'cta',
        //     'event_label': 'get_unfucked_button'
        // });

        console.log('CTA clicked - add your analytics tracking in is-your-website-fucked.js');
    });
});

// ============================================
// SCROLL ANIMATIONS (REMOVED)
// ============================================

// Animations removed per user request

// ============================================
// URL PARAMETER TRACKING (OPTIONAL)
// ============================================

// Capture UTM parameters and other tracking codes from URL
function captureUrlParameters() {
    const params = new URLSearchParams(window.location.search);
    const trackingData = {
        utm_source: params.get('utm_source'),
        utm_medium: params.get('utm_medium'),
        utm_campaign: params.get('utm_campaign'),
        utm_content: params.get('utm_content'),
        promo_code: params.get('promo') || params.get('code'),
        referrer: document.referrer,
        landing_page: window.location.href
    };

    // Store in sessionStorage for later use
    sessionStorage.setItem('tracking_data', JSON.stringify(trackingData));

    return trackingData;
}

// Add tracking data to form submission
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('contactForm');
    const trackingData = captureUrlParameters();

    form.addEventListener('submit', function() {
        // Add hidden fields with tracking data
        Object.keys(trackingData).forEach(key => {
            if (trackingData[key]) {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = key;
                input.value = trackingData[key];
                form.appendChild(input);
            }
        });
    });
});

// ============================================
// CONSOLE EASTER EGG
// ============================================

console.log('%c🔥 Is Your Website Fucked? 🔥', 'font-size: 24px; font-weight: bold; color: #FF0000;');
console.log('%cIf you\'re looking at this, you probably know what you\'re doing.', 'font-size: 14px;');
console.log('%cWant to work with us? Shoot us an email.', 'font-size: 14px;');
