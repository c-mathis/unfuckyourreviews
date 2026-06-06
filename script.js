// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    // Cloudflare Worker endpoint
    formEndpoint: 'https://unfuck-leads-worker.cameron-07f.workers.dev/',

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

        // Convert FormData to plain object
        const payload = {};
        formData.forEach((value, key) => {
            payload[key] = value;
        });

        // Add selected issues to payload
        if (selectedIssues.size > 0) {
            payload.selected_issues = Array.from(selectedIssues).join(' | ');
            payload.issues_count = selectedIssues.size;
        } else {
            payload.selected_issues = 'None selected';
            payload.issues_count = 0;
        }

        // Add tracking data to payload
        const trackingData = JSON.parse(sessionStorage.getItem('tracking_data') || '{}');
        Object.keys(trackingData).forEach(key => {
            if (trackingData[key]) {
                payload[key] = trackingData[key];
            }
        });

        try {
            console.log('Submitting payload:', payload);

            // Submit to configured endpoint
            const response = await fetch(CONFIG.formEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            console.log('Response status:', response.status);
            const responseData = await response.json();
            console.log('Response data:', responseData);

            if (response.ok && responseData.success) {
                // Extract form data for tracking
                const name = payload.name || '';
                const nameParts = name.trim().split(' ');
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || '';
                const situation = payload.situation || '';
                const website = payload.website || '';

                // Track Meta Pixel Lead event with advanced matching
                if (typeof fbq !== 'undefined') {
                    fbq('track', 'Lead', {
                        content_name: 'Review Management Service',
                        content_category: 'Service Inquiry',
                        value: 0,
                        currency: 'USD'
                    }, {
                        // Advanced matching for better attribution
                        em: payload.email,
                        fn: firstName,
                        ln: lastName,
                        external_id: website
                    });

                    // Also track Contact event (for custom conversion flexibility)
                    fbq('track', 'Contact', {
                        content_name: 'Review Management Service',
                        content_category: 'Service Inquiry',
                        value: 0,
                        currency: 'USD'
                    });
                }

                // Track Google Analytics Lead event
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'generate_lead', {
                        'event_category': 'conversion',
                        'event_label': situation,
                        'value': 399.00,
                        'currency': 'USD',
                        'has_website': website ? 'yes' : 'no'
                    });
                }

                console.log('Tracking: Lead conversion tracked');

                // Success - replace form with confirmation
                showConfirmation();
            } else {
                // Server error - log the actual error
                console.error('Server error:', responseData);
                throw new Error(responseData.error || 'Server returned an error');
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

    function showConfirmation() {
        // Replace entire CTA section with confirmation
        const ctaSection = document.querySelector('.cta-section');
        ctaSection.innerHTML = `
            <div class="confirmation-message">
                <div class="confirmation-icon">✓</div>
                <h2>Thanks, we're on the way.</h2>
                <p>Keep an eye out for our email so we can get rockin'.</p>
            </div>
        `;

        // Scroll to confirmation
        ctaSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
// ANALYTICS TRACKING
// ============================================

// Track ViewContent at 50% scroll
let viewContentTracked = false;
window.addEventListener('scroll', function() {
    if (viewContentTracked) return;

    const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;

    if (scrollPercent >= 50) {
        viewContentTracked = true;

        // Meta Pixel
        if (typeof fbq !== 'undefined') {
            fbq('track', 'ViewContent', {
                content_name: 'Unfuck Your Reviews Landing Page',
                content_category: 'Review Management Service'
            });
        }

        // Google Analytics
        if (typeof gtag !== 'undefined') {
            gtag('event', 'scroll', {
                'event_category': 'engagement',
                'event_label': '50_percent',
                'value': 50
            });
        }

        console.log('Tracking: 50% scroll tracked');
    }
});

// Track InitiateCheckout when form is started (first field clicked)
let formStartTracked = false;
document.addEventListener('DOMContentLoaded', function() {
    const formInputs = document.querySelectorAll('#contactForm input, #contactForm select');

    formInputs.forEach(input => {
        input.addEventListener('focus', function() {
            if (!formStartTracked) {
                formStartTracked = true;

                // Meta Pixel
                if (typeof fbq !== 'undefined') {
                    fbq('track', 'InitiateCheckout');
                }

                // Google Analytics
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'begin_checkout', {
                        'event_category': 'engagement',
                        'event_label': 'form_started'
                    });
                }

                console.log('Tracking: Form started');
            }
        }, { once: true });
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

// Capture tracking data on page load
document.addEventListener('DOMContentLoaded', function() {
    captureUrlParameters();
});

// ============================================
// CONSOLE EASTER EGG
// ============================================

console.log('%c⭐ Are Your Reviews Fucked? ⭐', 'font-size: 24px; font-weight: bold; color: #FF0000;');
console.log('%cIf you\'re looking at this, you probably know what you\'re doing.', 'font-size: 14px;');
console.log('%cWant to work with us? Shoot us an email.', 'font-size: 14px;');
