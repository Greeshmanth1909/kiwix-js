/**
 * uiUtil.js : Utility functions for the User Interface
 * 
 * Copyright 2013-2020 Mossroy and contributors
 * License GPL v3:
 * 
 * This file is part of Kiwix.
 * 
 * Kiwix is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * Kiwix is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with Kiwix (file LICENSE-GPLv3.txt).  If not, see <http://www.gnu.org/licenses/>
 */
'use strict';

// DEV: Put your RequireJS definition in the rqDef array below, and any function exports in the function parenthesis of the define statement
// We need to do it this way in order to load WebP polyfills conditionally. The WebP polyfills are only needed by a few old browsers, so loading them
// only if needed saves approximately 1MB of memory.
var rqDef = ['settingsStore'];

// Add WebP polyfill only if webpHero was loaded in init.js
if (webpMachine) {
    rqDef.push('webpHeroBundle');
}

define(rqDef, function(settingsStore) {

    /**
     * Displays a Bootstrap alert or confirm dialog box depending on the options provided
     * 
     * @param {String} message The alert message(can be formatted using HTML) to display in the body of the modal. 
     * @param {String} label The modal's label or title which appears in the header (optional, Default = "Confirmation" or "Message")
     * @param {Boolean} isConfirm If true, the modal will be a confirm dialog box, otherwise it will be a simple alert message 
     * @param {String} declineConfirmLabel The text to display on the decline confirmation button (optional, Default = "Cancel") 
     * @param {String} approveConfirmLabel  The text to display on the approve confirmation button (optional, Default = "Confirm")
     * @param {String} closeMessageLabel  The text to display on the close alert message button (optional, Default = "Okay")
     * @returns {Promise<Boolean>} A promise which resolves to true if the user clicked Confirm, false if the user clicked Cancel/Okay, backdrop or the cross(x) button
     */
    function systemAlert(message, label, isConfirm, declineConfirmLabel, approveConfirmLabel, closeMessageLabel) {
        declineConfirmLabel = declineConfirmLabel || "Cancel";
        approveConfirmLabel = approveConfirmLabel || "Confirm";
        closeMessageLabel = closeMessageLabel || "Okay";
        label = label || (isConfirm ? "Confirmation" : "Message");
        return new Promise(function (resolve, reject) {
            if (!message) reject("Missing body message");
            // Set the text to the modal and its buttons
            document.getElementById("approveConfirm").textContent = approveConfirmLabel;
            document.getElementById("declineConfirm").textContent = declineConfirmLabel;
            document.getElementById("closeMessage").textContent = closeMessageLabel;
            document.getElementById("modalLabel").textContent = label;
            // Using innerHTML to set the message to allow HTML formatting
            document.getElementById("modalText").innerHTML = message;
            // Display buttons acc to the type of alert
            document.getElementById("approveConfirm").style.display = isConfirm ? "inline" : "none";
            document.getElementById("declineConfirm").style.display = isConfirm ? "inline" : "none";
            document.getElementById("closeMessage").style.display = isConfirm ? "none" : "inline";
            // Display the modal
            $("#alertModal").modal("show");
            // When hide model is called, resolve promise with true if hidden using approve button, false otherwise
            $("#alertModal").on("hide.bs.modal", function () {
                const closeSource = document.activeElement;
                if (closeSource.id === "approveConfirm") {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
            document.getElementById('alertModal').addEventListener('keyup', function (e) {
                if (/Enter/.test(e.key)){
                    // We need to focus before clicking the button, because the handler above is based on document.activeElement
                    if (isConfirm) {
                        document.getElementById('approveConfirm').focus();
                        document.getElementById('approveConfirm').click();
                    } else {
                        document.getElementById('closeMessage').focus();
                        document.getElementById('closeMessage').click();
                    }
                }
            });
        });
    }
  
    /**
     * Creates a data: URI from the given content
     * The given attribute of the DOM node (nodeAttribute) is then set to this URI
     * 
     * This is used to inject images (and other dependencies) into the article DOM
     * 
     * @param {Object} node The node to which the URI should be added
     * @param {String} nodeAttribute The attribute to set to the URI
     * @param {Uint8Array} content The binary content to convert to a URI
     * @param {String} mimeType The MIME type of the content
     * @param {Function} callback An optional function to call to start processing the next item
     */
    function feedNodeWithDataURI(node, nodeAttribute, content, mimeType, callback) {
        // Decode WebP data if the browser does not support WebP and the mimeType is webp
        if (webpMachine && /image\/webp/i.test(mimeType)) {
            // If we're dealing with a dataURI, first convert to Uint8Array
            if (/^data:/i.test(content)) {
                // Using webpHero's utility: it uses deprecated atob() but should be OK for WebP image data
                // DEV: If you ever need an alternative to atob(), please see Mozilla-recommended methods: https://developer.mozilla.org/en-US/docs/Glossary/Base64
                content = webpHero.convertDataURIToBinary(content);
            }
            // DEV: Note that webpMachine is single threaded and will reject an image if it is busy
            // However, the loadImagesJQuery() function in app.js is sequential (it waits for a callback
            // before processing another image) so we do not need to queue WebP images here
            var canvas = document.createElement('canvas');
            webpMachine.decodeToCanvas(canvas, content).then(function () {
                if (callback) callback(); // Calling back as soon as possible speeds up extraction
                if (params.useCanvasElementsForWebpTranscoding) {
                    // Replace images by canvas. This is necessary for some browsers with obsolete anti-fingerprinting protection, like IceCat 60.7
                    webpMachine.constructor.replaceImageWithCanvas(node, canvas);
                } else {
                    // For standard browsers that have access to the canvas, we simply convert the canvas to a data URI
                    node.setAttribute(nodeAttribute, canvas.toDataURL());
                }
            }).catch(function (err) {
                console.error('There was an error decoding image in WebpMachine', err);
                if (callback) callback();
            });
        } else {
            if (callback) callback(); // Calling back as soon as possible speeds up extraction
            // In browsers that support WebP natively, or for non-WebP images, we can simply convert the Uint8Array to a data URI
            // DEV: we use FileReader method because btoa fails on utf8 strings (in SVGs, for example)
            // See https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding#The_Unicode_Problem
            // This native browser method is very fast: see https://stackoverflow.com/a/66046176/9727685
            var myReader = new FileReader();
            myReader.onloadend = function () {
                var url = myReader.result;
                node.setAttribute(nodeAttribute, url);
            };
            myReader.readAsDataURL(new Blob([content], { type: mimeType }));
        }
    }

    /**
     * Determines whether the Canvas Elements Workaround for decoding WebP images is needed, and sets UI accordingly.
     * This also sets a global app parameter (useCanvasElementsForWebpTranscoding) that determines whether the workaround will be used in jQuery mode.
     * Note that the workaround will never be used in Service Worker mode, but we still need to determine it in case the user switches modes.
     * @returns {Boolean} A value to indicate the browser's capability (whether it requires the workaround or not) 
     */
    function determineCanvasElementsWorkaround() {
        var userPreference = settingsStore.getItem('useCanvasElementsForWebpTranscoding') !== 'false';
        // Determine whether the browser is able to read canvas data correctly
        var browserRequiresWorkaround = webpMachine && webpHero && !webpHero.detectCanvasReadingSupport();
        console.debug('Determination for canvas elements workaround with WebP transcoding is: ' + browserRequiresWorkaround);
        // Hide the UI for this feature (we'll display it below if needed)
        var imgHandlingModeDiv = document.getElementById('imgHandlingModeDiv');
        var useCanvasElementsCheck = document.getElementById('useCanvasElementsCheck');
        imgHandlingModeDiv.style.display = 'none';
        useCanvasElementsCheck.checked = false;
        if (browserRequiresWorkaround && params.contentInjectionMode === 'jquery') {
            // The feature is required, so display the UI
            imgHandlingModeDiv.style.display = 'block';
            useCanvasElementsCheck.checked = userPreference;
        }
        params.useCanvasElementsForWebpTranscoding = browserRequiresWorkaround ? userPreference : false;
         // Return the determined browser capability (which may be different from the user's preference) in case caller wants this
        return browserRequiresWorkaround;
    }

    /**
     * Replace the given CSS link (from the DOM) with an inline CSS of the given content
     * 
     * Due to CSP, Firefox OS does not accept <link> syntax with href="data:text/css..." or href="blob:..."
     * So we replace the tag with a <style type="text/css">...</style>
     * while copying some attributes of the original tag
     * Cf http://jonraasch.com/blog/javascript-style-node
     * 
     * @param {Element} link The original link node from the DOM
     * @param {String} cssContent The content to insert as an inline stylesheet
     */
    function replaceCSSLinkWithInlineCSS (link, cssContent) {
        var cssElement = document.createElement('style');
        cssElement.type = 'text/css';
        if (cssElement.styleSheet) {
            cssElement.styleSheet.cssText = cssContent;
        } else {
            cssElement.appendChild(document.createTextNode(cssContent));
        }
        var mediaAttributeValue = link.getAttribute('media');
        if (mediaAttributeValue) {
            cssElement.media = mediaAttributeValue;
        }
        var disabledAttributeValue = link.getAttribute('disabled');
        if (disabledAttributeValue) {
            cssElement.disabled = disabledAttributeValue;
        }
        link.parentNode.replaceChild(cssElement, link);
    }
        
    /**
     * Removes parameters and anchors from a URL
     * @param {type} url The URL to be processed
     * @returns {String} The same URL without its parameters and anchors
     */
    function removeUrlParameters(url) {
        // Remove any querystring
        var strippedUrl = url.replace(/\?[^?]*$/, '');
        // Remove any anchor parameters - note that we are deliberately excluding entity references, e.g. '&#39;'.
        strippedUrl = strippedUrl.replace(/#[^#;]*$/, '');
        return strippedUrl;
    }

    /**
     * Derives the URL.pathname from a relative or semi-relative URL using the given base ZIM URL
     * 
     * @param {String} url The (URI-encoded) URL to convert (e.g. "Einstein", "../Einstein",
     *      "../../I/im%C3%A1gen.png", "-/s/style.css", "/A/Einstein.html", "../static/bootstrap/css/bootstrap.min.css")
     * @param {String} base The base ZIM URL of the currently loaded article (e.g. "A/", "A/subdir1/subdir2/", "C/Singapore/")
     * @returns {String} The derived ZIM URL in decoded form (e.g. "A/Einstein", "I/imágen.png", "C/")
     */
    function deriveZimUrlFromRelativeUrl(url, base) {
        // We use a dummy domain because URL API requires a valid URI
        var dummy = 'http://d/';
        var deriveZimUrl = function (url, base) {
            if (typeof URL === 'function') return new URL(url, base);
            // IE11 lacks URL API: workaround adapted from https://stackoverflow.com/a/28183162/9727685
            var d = document.implementation.createHTMLDocument('t');
            d.head.innerHTML = '<base href="' + base + '">';
            var a = d.createElement('a');
            a.href = url;
            return { pathname: a.href.replace(dummy, '') };
        };
        var zimUrl = deriveZimUrl(url, dummy + base);
        return decodeURIComponent(zimUrl.pathname.replace(/^\//, ''));
    }

    /**
     * Displays a Bootstrap warning alert with information about how to access content in a ZIM with unsupported active UI
     */
    var activeContentWarningSetup = false;
    function displayActiveContentWarning() {
        var alertActiveContent = document.getElementById('activeContent');
        alertActiveContent.style.display = '';
        if (!activeContentWarningSetup) {
            // We are setting up the active content warning for the first time
            activeContentWarningSetup = true;
            alertActiveContent.querySelector('button[data-hide]').addEventListener('click', function() {
                alertActiveContent.style.display = 'none';
            });
            ['swModeLink', 'stop'].forEach(function(id) {
                // Define event listeners for both hyperlinks in alert box: these take the user to the Config tab and highlight
                // the options that the user needs to select
                document.getElementById(id).addEventListener('click', function () {
                    var elementID = id === 'stop' ? 'hideActiveContentWarningCheck' : 'serviceworkerModeRadio';
                    var thisLabel = document.getElementById(elementID).parentNode;
                    thisLabel.style.borderColor = 'red';
                    thisLabel.style.borderStyle = 'solid';
                    var btnHome = document.getElementById('btnHome');
                    [thisLabel, btnHome].forEach(function (ele) {
                        // Define event listeners to cancel the highlighting both on the highlighted element and on the Home tab
                        ele.addEventListener('mousedown', function () {
                            thisLabel.style.borderColor = '';
                            thisLabel.style.borderStyle = '';
                        });
                    });
                    document.getElementById('btnConfigure').click();
                });
            });
        }
    }

    /**
     * Displays a Bootstrap alert box at the foot of the page to enable saving the content of the given title to the device's filesystem
     * and initiates download/save process if this is supported by the OS or Browser
     * 
     * @param {String} title The path and filename to the file to be extracted
     * @param {Boolean|String} download A Bolean value that will trigger download of title, or the filename that should
     *     be used to save the file in local FS
     * @param {String} contentType The mimetype of the downloadable file, if known
     * @param {Uint8Array} content The binary-format content of the downloadable file
     */
    var downloadAlertSetup = false;
    function displayFileDownloadAlert(title, download, contentType, content) {
        var downloadAlert = document.getElementById('downloadAlert');
        downloadAlert.style.display = 'block';
        if (!downloadAlertSetup) downloadAlert.querySelector('button[data-hide]').addEventListener('click', function() {
            // We are setting up the alert for the first time
            downloadAlert.style.display = 'none';
        });
        downloadAlertSetup = true;
        // Download code adapted from https://stackoverflow.com/a/19230668/9727685 
        // Set default contentType if none was provided
        if (!contentType) contentType = 'application/octet-stream';
        var a = document.createElement('a');
        var blob = new Blob([content], { 'type': contentType });
        // If the filename to use for saving has not been specified, construct it from title
        var filename = download === true ? title.replace(/^.*\/([^\/]+)$/, '$1') : download;
        // Make filename safe
        filename = filename.replace(/[\/\\:*?"<>|]/g, '_');
        a.href = window.URL.createObjectURL(blob);
        a.target = '_blank';
        a.type = contentType;
        a.download = filename;
        a.classList.add('alert-link');
        a.innerHTML = filename;
        var alertMessage = document.getElementById('alertMessage');
        alertMessage.innerHTML = '<strong>Download</strong> If the download does not start, please tap the following link: ';
        // We have to add the anchor to a UI element for Firefox to be able to click it programmatically: see https://stackoverflow.com/a/27280611/9727685
        alertMessage.appendChild(a);
        try { a.click(); }
        catch (err) {
            // If the click fails, user may be able to download by manually clicking the link
            // But for IE11 we need to force use of the saveBlob method with the onclick event 
            if (window.navigator && window.navigator.msSaveBlob) {
                a.addEventListener('click', function(e) {
                    window.navigator.msSaveBlob(blob, filename);
                    e.preventDefault();
                });
            }
        }
        document.getElementById('searchingArticles').style.display = 'none';
    }

    /**
     * Check for update of Service Worker (PWA) and display information to user
     */
    var updateAlert = document.getElementById('updateAlert');
    function checkUpdateStatus(appstate) {
        if ('serviceWorker' in navigator && !appstate.pwaUpdateNeeded) {
            settingsStore.getCacheNames(function (cacheNames) {
                if (cacheNames && !cacheNames.error) {
                    // Store the cacheNames globally for use elsewhere
                    params.cacheNames = cacheNames;
                    caches.keys().then(function (keyList) {
                        updateAlert.style.display = 'none';
                        var cachePrefix = cacheNames.app.replace(/^([^\d]+).+/, '$1');
                        keyList.forEach(function (key) {
                            if (key === cacheNames.app || key === cacheNames.assets) return;
                            // Ignore any keys that do not begin with the appCache prefix (they could be from other apps using the same domain)
                            if (key.indexOf(cachePrefix)) return;
                            // If we get here, then there is a cache key that does not match our version, i.e. a PWA-in-waiting
                            appstate.pwaUpdateNeeded = true;
                            updateAlert.style.display = 'block';
                            document.getElementById('persistentMessage').innerHTML = 'Version ' + key.replace(cachePrefix, '') +
                                ' is ready to install. (Re-launch app to install.)';
                        });
                    });
                }
            });
        }
    }
    if (updateAlert) updateAlert.querySelector('button[data-hide]').addEventListener('click', function () {
        updateAlert.style.display = 'none';
    });

    /**
     * Checks if a server is accessible by attempting to load a test image from the server
     * @param {String} imageSrc The full URI of the image
     * @param {any} onSuccess A function to call if the image can be loaded
     * @param {any} onError A function to call if the image cannot be loaded
     */
     function checkServerIsAccessible(imageSrc, onSuccess, onError) {
        var image = new Image();
        image.onload = onSuccess;
        image.onerror = onError;
        image.src = imageSrc;
    }

    /**
     * Show or hide the spinner together with a message
     * @param {Boolean} show True to show the spinner, false to hide it 
     * @param {String} message A message to display, or hide the message if null 
     */
    function spinnerDisplay(show, message) {
        var searchingArticles = document.getElementById('searchingArticles');
        var spinnerMessage = document.getElementById('cachingAssets');
        if (show) searchingArticles.style.display = 'block';
        else searchingArticles.style.display = 'none';
        if (message) {
            spinnerMessage.innerHTML = message;
            spinnerMessage.style.display = 'block';
        } else {
            spinnerMessage.innerHTML = 'Caching assets...';
            spinnerMessage.style.display = 'none';
        }
    }

    /**
     * Checks whether an element is partially or fully inside the current viewport
     * 
     * @param {Element} el The DOM element for which to check visibility
     * @param {Boolean} fully If true, checks that the entire element is inside the viewport; 
     *          if false, checks whether any part of the element is inside the viewport
     * @returns {Boolean} True if the element is fully or partially (depending on the value of <fully>)
     *          inside the current viewport
     */
    function isElementInView(el, fully) {
        var rect = el.getBoundingClientRect();
        if (fully)
            return rect.top > 0 && rect.bottom < window.innerHeight && rect.left > 0 && rect.right < window.innerWidth;
        else 
            return rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0;
    }

    /**
     * Removes the animation effect between various sections
     */
    function removeAnimationClasses() {
        var configuration = document.getElementById('configuration');
        configuration.classList.remove('slideIn_L');
        configuration.classList.remove('slideIn_R');
        configuration.classList.remove('slideOut_L');
        configuration.classList.remove('slideOut_R');
        document.getElementById('about').classList.remove('slideIn_L');
        document.getElementById('about').classList.remove('slideOut_R');
        document.getElementById('articleContent').classList.remove('slideIn_R');
        document.getElementById('articleContent').classList.remove('slideOut_L');
    }
    
    /**
     * Adds the slide animation between different sections
     * 
     * @param {String} section It takes the name of the section to which the animation is to be added
     * 
     */
    function applyAnimationToSection(section) {
        if (section == 'home') {
            if (!$('#configuration').is(':hidden')) {
                document.getElementById('configuration').classList.add('slideOut_R');
                setTimeout(function () {
                    document.getElementById('configuration').style.display = 'none';
                }, 300);
            }
            if (!$('#about').is(':hidden')) {
                document.getElementById('about').classList.add('slideOut_R');
                setTimeout(function () {
                    document.getElementById('about').style.display = 'none';
                }, 300);
            }
            $('#articleContent').addClass('slideIn_R');
            setTimeout(function () {
                document.getElementById('articleContent').style.display = '';
            }, 300);
        } else if (section == 'config') {
            if (!$('#about').is(':hidden')) {
                $('#about').addClass('slideOut_R');
                $('#configuration').addClass('slideIn_R');
                setTimeout(function () {
                    document.getElementById('about').style.display = 'none';
                }, 300);
            } else if (!$('#articleContent').is(':hidden')) {
                document.getElementById('configuration').classList.add('slideIn_L');
                document.getElementById('articleContent').classList.add('slideOut_L');
                setTimeout(function () {
                    document.getElementById('articleContent').style.display = 'none';
                }, 300);
            }
            setTimeout(function () {
                document.getElementById('configuration').style.display = '';
            }, 300);
        } else if (section == 'about') {
            if (!$('#configuration').is(':hidden')) {
                document.getElementById('configuration').classList.add('slideOut_L');
                setTimeout(function () {
                    document.getElementById('configuration').style.display = 'none';
                }, 300);
            }
            if (!$('#articleContent').is(':hidden')) {
                document.getElementById('articleContent').classList.add('slideOut_L');
                setTimeout(function () {
                    document.getElementById('articleContent').style.display = 'none';
                }, 300);
            }
            document.getElementById('about').classList.add('slideIn_L');
            setTimeout(function () {
                document.getElementById('about').style.display = '';
            }, 300);
        }
    }

    /**
     * Applies the requested app and content theme
     * 
     * A <theme> string consists of two parts, the appTheme (theme to apply to the app shell only), and an optional
     * contentTheme beginning with an underscore: e.g. 'dark_invert' = 'dark' (appTheme) + '_invert' (contentTheme)
     * Current themes are: light, dark, dark_invert, dark_mwInvert but code below is written for extensibility
     * For each appTheme (except the default 'light'), a corresponding set of rules must be present in app.css
     * For each contentTheme, a stylesheet must be provided in www/css that is named 'kiwixJS' + contentTheme
     * A rule may additionally be needed in app.css for full implementation of contentTheme
     * 
     * @param {String} theme The theme to apply (light|dark[_invert|_mwInvert]|auto[_invert|_mwInvert])
     */
    function applyAppTheme(theme) {
        var darkPreference = window.matchMedia('(prefers-color-scheme:dark)');
        // Resolve the app theme from the matchMedia preference (for auto themes) or from the theme string
        var appTheme = /^auto/.test(theme) ? darkPreference.matches ? 'dark' : 'light' : theme.replace(/_.*$/, '');
        // Get contentTheme from chosen theme
        var contentTheme = theme.replace(/^[^_]*/, '');
        var htmlEl = document.querySelector('html');
        var footer = document.querySelector('footer');
        var oldTheme = htmlEl.dataset.theme || '';
        var iframe = document.getElementById('articleContent');
        var doc = iframe.contentDocument;
        var kiwixJSSheet = doc ? doc.getElementById('kiwixJSTheme') || null : null;
        var oldAppTheme = oldTheme.replace(/_.*$/, '');
        var oldContentTheme = oldTheme.replace(/^[^_]*/, '');
        // Remove oldAppTheme and oldContentTheme
        if (oldAppTheme) htmlEl.classList.remove(oldAppTheme);
        // A missing contentTheme implies _light
        footer.classList.remove(oldContentTheme || '_light');
        // Apply new appTheme (NB it will not be added twice if it's already there)
        if (appTheme) htmlEl.classList.add(appTheme);
        // We also add the contentTheme to the footer to avoid dark css rule being applied to footer when content
        // is not dark (but we want it applied when the content is dark or inverted)
        footer.classList.add(contentTheme || '_light');
        // Embed a reference to applied theme, so we can remove it generically in the future
        htmlEl.dataset.theme = appTheme + contentTheme;
        // Hide any previously displayed help
        var oldHelp = document.getElementById(oldContentTheme.replace(/_/, '') + '-help');
        if (oldHelp) oldHelp.style.display = 'none';
        // Show any specific help for selected contentTheme
        var help = document.getElementById(contentTheme.replace(/_/, '') + '-help');
        if (help) help.style.display = 'block';
        // Remove the contentTheme for auto themes whenever system is in light mode
        if (/^auto/.test(theme) && appTheme === 'light') contentTheme = null;
        // Hide any previously displayed description for auto themes
        var oldDescription = document.getElementById('kiwix-auto-description');
        if (oldDescription) oldDescription.style.display = 'none';
        // Show description for auto themes 
        var description = document.getElementById('kiwix-' + theme.replace(/_.*$/, '') + '-description');
        if (description) description.style.display = 'block';
        // If there is no ContentTheme or we are applying a different ContentTheme, remove any previously applied ContentTheme
        if (oldContentTheme && oldContentTheme !== contentTheme) {
            iframe.classList.remove(oldContentTheme);
            if (kiwixJSSheet) {
                kiwixJSSheet.disabled = true;
                kiwixJSSheet.parentNode.removeChild(kiwixJSSheet);
            }
        }
        // Apply the requested ContentTheme (if not already attached)
        if (contentTheme && (!kiwixJSSheet || !~kiwixJSSheet.href.search('kiwixJS' + contentTheme + '.css'))) {
            iframe.classList.add(contentTheme);
            // Use an absolute reference because Service Worker needs this (if an article loaded in SW mode is in a ZIM
            // subdirectory, then relative links injected into the article will not work as expected)
            // Note that location.pathname returns the path plus the filename, but is useful because it removes any query string
            var prefix = (window.location.protocol + '//' + window.location.host + window.location.pathname).replace(/\/[^/]*$/, '');
            if (doc) {
                var link = doc.createElement('link');
                link.setAttribute('id', 'kiwixJSTheme');
                link.setAttribute('rel', 'stylesheet');
                link.setAttribute('type', 'text/css');
                link.setAttribute('href', prefix + '/css/kiwixJS' + contentTheme + '.css');
                doc.head.appendChild(link);
            }
        }
        // If we are in Config and a real document has been loaded already, expose return link so user can see the result of the change
        // DEV: The Placeholder string below matches the dummy article.html that is loaded before any articles are loaded
        if (document.getElementById('liConfigureNav').classList.contains('active') && doc &&
            doc.title !== "Placeholder for injecting an article into the iframe") {
            showReturnLink();
        }
    }

    // Displays the return link and handles click event. Called by applyAppTheme()
    function showReturnLink() {
        var viewArticle = document.getElementById('viewArticle');
        viewArticle.style.display = 'block';
        viewArticle.addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('liConfigureNav').classList.remove('active');
            document.getElementById('liHomeNav').classList.add('active');
            removeAnimationClasses();
            if (params.showUIAnimations) { 
                applyAnimationToSection('home');
            } else {
                document.getElementById('configuration').style.display = 'none';
                document.getElementById('articleContent').style.display = 'block';
            }
            document.getElementById('navigationButtons').style.display = 'inline-flex';
            document.getElementById('formArticleSearch').style.display = 'block';
            viewArticle.style.display = 'none';
        });
    }

    // Reports an error in loading one of the ASM or WASM machines to the UI API Status Panel
    // This can't be done in app.js because the error occurs after the API panel is first displayed
    function reportAssemblerErrorToAPIStatusPanel(decoderType, error, assemblerMachineType) {
        console.error('Could not instantiate any ' + decoderType + ' decoder!', error);
        params.decompressorAPI.assemblerMachineType = assemblerMachineType;
        params.decompressorAPI.errorStatus = 'Error loading ' + decoderType + ' decompressor!';
        var decompAPI = document.getElementById('decompressorAPIStatus');
        decompAPI.innerHTML = 'Decompressor API: ' + params.decompressorAPI.errorStatus;
        decompAPI.className = 'apiBroken';
        document.getElementById('apiStatusDiv').className = 'card card-danger';
    }

    // Reports the search provider to the API Status Panel
    function reportSearchProviderToAPIStatusPanel(provider) {
        var providerAPI = document.getElementById('searchProvider');
        if (providerAPI) {
            providerAPI.innerHTML = 'Search Provider: ' + (provider === 'fulltext' ? 'Title + Xapian (full text)' : 'Title only');
            providerAPI.className = provider === 'fulltext' ? 'apiAvailable' : 'apiUnavailable';
        }
    }

    // If global variable webpMachine is true (set in init.js), then we need to initialize the WebP Polyfill
    if (webpMachine) webpMachine = new webpHero.WebpMachine({useCanvasElements: true});
    
    /**
     * Warn the user that he/she clicked on an external link, and open it in a new tab
     * 
     * @param {Event} event the click event (on an anchor) to handle
     * @param {Element} clickedAnchor the DOM anchor that has been clicked (optional, defaults to event.target)
     */
    function warnAndOpenExternalLinkInNewTab(event, clickedAnchor) {
        event.preventDefault();
        event.stopPropagation();
        if (!clickedAnchor) clickedAnchor = event.target;
        var target = clickedAnchor.target;
        var message = '<p>Do you want to open this external link?';
        if (!target || target === '_blank') {
            message += ' (in a new tab)';
        }
        message += '</p><p style="word-break:break-all;">' + clickedAnchor.href + '</p>';
        systemAlert(message, 'Opening external link', true).then(function (response) {
            if (response) {
                if (!target)
                    target = '_blank';
                window.open(clickedAnchor.href, target);
            }
        });
    }
    
    /**
     * Finds the closest <a> or <area> enclosing tag of an element.
     * Returns undefined if there isn't any.
     * 
     * @param {Element} element
     * @returns {Element} closest enclosing anchor tag (if any)
     */
    function closestAnchorEnclosingElement(element) {
        if (Element.prototype.closest) {
            // Recent browsers support that natively. See https://developer.mozilla.org/en-US/docs/Web/API/Element/closest
            return element.closest('a,area');
        } else {
            // For other browsers, notably IE, we do that by hand (we did not manage to make polyfills work on IE11)
            var currentElement = element;
            while (currentElement.tagName !== 'A' && currentElement.tagName !== 'AREA') {
                // If there is no parent Element, we did not find any enclosing A tag
                if (!currentElement.parentElement) {
                    return;
                } else {
                    // Else we try the next parent Element
                    currentElement = currentElement.parentElement;
                }
            }
            // If we reach this line, it means the currentElement is the enclosing Anchor we're looking for
            return currentElement;
        }
    }

    /**
     * Functions and classes exposed by this module
     */
    return {
        systemAlert: systemAlert,
        feedNodeWithDataURI: feedNodeWithDataURI,
        determineCanvasElementsWorkaround: determineCanvasElementsWorkaround,
        replaceCSSLinkWithInlineCSS: replaceCSSLinkWithInlineCSS,
        deriveZimUrlFromRelativeUrl: deriveZimUrlFromRelativeUrl,
        removeUrlParameters: removeUrlParameters,
        displayActiveContentWarning: displayActiveContentWarning,
        displayFileDownloadAlert: displayFileDownloadAlert,
        checkUpdateStatus: checkUpdateStatus,
        checkServerIsAccessible: checkServerIsAccessible,
        spinnerDisplay: spinnerDisplay,
        isElementInView: isElementInView,
        removeAnimationClasses: removeAnimationClasses,
        applyAnimationToSection: applyAnimationToSection,
        applyAppTheme: applyAppTheme,
        reportAssemblerErrorToAPIStatusPanel: reportAssemblerErrorToAPIStatusPanel,
        reportSearchProviderToAPIStatusPanel: reportSearchProviderToAPIStatusPanel,
        warnAndOpenExternalLinkInNewTab: warnAndOpenExternalLinkInNewTab,
        closestAnchorEnclosingElement: closestAnchorEnclosingElement
    };
});
