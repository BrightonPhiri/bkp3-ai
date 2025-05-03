        $(document).ready(function() {
            const API_KEY = 'd860911ad19af07b8e7585a949df76edd0cf80afc86f93077a6697535ad472eb';
            let chatHistory = [];
            let isLocalMode = false;
            let audioQueue = [];
            let chatSessions = [];
            let currentChatId = null;
            let currentUser = null;
            const MAX_SAVED_CHATS = 10;
            
            // Initially hide app container and login screen until auth state is determined
            $('#app-container').hide();
            $('#login-screen').hide();
            
            // Utility function to safely toggle the no history message
            function toggleNoHistoryMessage(show) {
                const noHistoryMessage = $('#no-history-message');
                if (noHistoryMessage.length) {
                    if (show) {
                        noHistoryMessage.show();
                        console.log("No history message shown");
                    } else {
                        noHistoryMessage.hide();
                        console.log("No history message hidden");
                    }
                } else {
                    console.warn("No history message element not found!");
                }
            }
            
            // Authentication state observer
            firebase.auth().onAuthStateChanged(function(user) {
                if (user) {
                    // User is signed in
                    currentUser = user;
                    
                    // Update user info in the sidebar
                    $('#user-display-name').text(user.displayName || user.email.split('@')[0]);
                    $('#user-email').text(user.email);
                    
                    $('#login-screen').hide();
                    $('#app-container').show();
                    
                    // Show welcome screen first
                    showWelcomeScreen();
                    
                    // Check if email is verified and show a notification if not
                    if (!user.emailVerified && user.providerData[0].providerId === 'password') {
                        const emailVerificationNotice = $(`
                            <div class="email-verification-notice alert alert-warning alert-dismissible fade show" role="alert">
                                <i class="fas fa-envelope-open-text me-2"></i>
                                <strong>Your email is not verified!</strong> Please check your inbox and verify your email.
                                <button type="button" id="resend-verification" class="btn btn-sm btn-warning ms-2">Resend verification</button>
                                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                            </div>
                        `);
                        
                        // Add the notice at the top of the chat body or under the navbar
                        if ($('#email-verification-container').length === 0) {
                            $('<div id="email-verification-container"></div>').insertAfter('.navbar-container');
                        }
                        $('#email-verification-container').html(emailVerificationNotice);
                        
                        // Add resend verification handler
                        $('#resend-verification').click(function() {
                            user.sendEmailVerification().then(function() {
                                // Update notice to show success
                                $(this).closest('.email-verification-notice').removeClass('alert-warning').addClass('alert-success')
                                    .html('<i class="fas fa-check-circle me-2"></i> Verification email sent! Please check your inbox.');
                                setTimeout(() => {
                                    $('.email-verification-notice').alert('close');
                                }, 5000);
                            }).catch(function(error) {
                                console.error("Error sending verification email:", error);
                                alert("Error sending verification email. Please try again later.");
                            });
                        });
                    } else {
                        // Remove verification notice if it exists and user is verified
                        $('#email-verification-container').remove();
                    }
                    
                    // Then load user's chat history
                    console.log("User signed in, loading chat history in background");
                    loadUserChatHistory();
                    
                    console.log("User signed in:", user.email);
                } else {
                    // User is signed out
                    currentUser = null;
                    $('#login-screen').show();
                    $('#app-container').hide();
                    
                    // Clear chat sessions
                    chatSessions = [];
                    currentChatId = null;
                    
                    console.log("User signed out");
                }
            });
            
            // Check if we're running from a local file
            if (window.location.protocol === 'file:') {
                isLocalMode = true;
                $('#local-mode-warning').show();
                $('#status-message').html('<i class="fas fa-info-circle"></i> Running in demo mode with simulated responses');
            }
            
            // Initialize Authentication UI
            initializeAuthUI();
            
            // Show auth modal when login button is clicked
            $('#show-auth-modal').click(function(e) {
                e.preventDefault();
                // Use Bootstrap's JavaScript API to show the modal
                const authModal = new bootstrap.Modal(document.getElementById('authModal'));
                authModal.show();
            });
            
            // Toggle between login and signup forms
            $('#show-signup').click(function(e) {
                e.preventDefault();
                $('#login-form').hide();
                $('#signup-form').show();
                $('#authModalLabel').text('Sign Up');
            });
            
            $('#show-signin').click(function(e) {
                e.preventDefault();
                $('#signup-form').hide();
                $('#login-form').show();
                $('#authModalLabel').text('Sign In');
            });
            
            // Handle login form submission
            $('#signin-form').submit(function(e) {
                e.preventDefault();
                
                const email = $('#email').val();
                const password = $('#password').val();
                
                // Clear error messages
                $('#auth-error').hide().text('');
                
                // Show loading indicator
                $('#signin-btn').html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Signing in...').prop('disabled', true);
                
                // Sign in with email and password
                firebase.auth().signInWithEmailAndPassword(email, password)
                    .then((userCredential) => {
                        // Check if email is verified
                        if (userCredential.user.emailVerified) {
                            // Email is verified, allow login
                            $('#authModal').modal('hide');
                            
                            // Clear the form
                            $('#signin-form')[0].reset();
                            $('#signin-btn').html('Sign In').prop('disabled', false);
                        } else {
                            // Email not verified, sign them out and show verification needed message
                            firebase.auth().signOut().then(() => {
                                $('#signin-form').hide();
                                $('#auth-error').hide();
                                
                                // Show verification needed message
                                $('#auth-success')
                                    .html(`
                                        <div class="text-center">
                                            <i class="fas fa-envelope-open-text verification-icon mb-3 text-warning"></i>
                                            <h4>Email Not Verified</h4>
                                            <p>You need to verify your email address before signing in.</p>
                                            <p>We've sent a verification link to <strong>${email}</strong></p>
                                            <div class="d-grid gap-2 mt-3">
                                                <button type="button" class="btn btn-warning" id="resend-verification-email">
                                                    Resend Verification Email
                                                </button>
                                                <button type="button" class="btn btn-outline-secondary" id="try-different-account">
                                                    Try Different Account
                                                </button>
                                            </div>
                                        </div>
                                    `)
                                    .removeClass('alert-success').addClass('alert-warning')
                                    .show();
                                
                                // Add handler for resend button
                                $('#resend-verification-email').click(function() {
                                    // Temporarily sign in to resend verification
                                    firebase.auth().signInWithEmailAndPassword(email, password)
                                        .then((userCred) => {
                                            return userCred.user.sendEmailVerification();
                                        })
                                        .then(() => {
                                            // Sign out again
                                            return firebase.auth().signOut();
                                        })
                                        .then(() => {
                                            // Show success message
                                            $('#auth-success')
                                                .html(`
                                                    <div class="text-center">
                                                        <i class="fas fa-envelope-open-text verification-icon mb-3"></i>
                                                        <h4>Verification Email Sent!</h4>
                                                        <p>We've sent a new verification link to <strong>${email}</strong></p>
                                                        <p>Please check your inbox and click the link to verify your email address.</p>
                                                        <button type="button" class="btn btn-outline-success mt-3" id="back-to-login">
                                                            Back to Sign In
                                                        </button>
                                                    </div>
                                                `)
                                                .removeClass('alert-warning').addClass('alert-success');
                                            
                                            // Add handler for back to login button
                                            $('#back-to-login').click(function() {
                                                $('#auth-success').hide();
                                                $('#signin-form').show();
                                                $('#signin-btn').html('Sign In').prop('disabled', false);
                                            });
                                        })
                                        .catch((error) => {
                                            console.error("Error resending verification:", error);
                                            $('#auth-error').text("Error resending verification email. Please try again.").show();
                                        });
                                });
                                
                                // Add handler for try different account button
                                $('#try-different-account').click(function() {
                                    $('#auth-success').hide();
                                    $('#signin-form').show();
                                    $('#signin-form')[0].reset();
                                    $('#signin-btn').html('Sign In').prop('disabled', false);
                                });
                            });
                        
                        // Reset button
                        $('#signin-btn').html('Sign In').prop('disabled', false);
                    }
                })
                .catch((error) => {
                    // Reset button
                    $('#signin-btn').html('Sign In').prop('disabled', false);
                    
                    // Handle specific errors with enhanced UI
                    if (error.code === 'auth/user-not-found') {
                        // No account found with this email
                        $('#auth-error').html(`
                            <div class="d-flex align-items-center justify-content-between">
                                <div>
                                    <i class="fas fa-exclamation-circle text-danger me-2"></i>
                                    <span>${getAuthErrorMessage(error.code)}</span>
                                </div>
                                <button type="button" class="btn btn-sm btn-outline-primary" id="create-account-btn">
                                    Create Account
                                </button>
                            </div>
                        `).show();
                        
                        // Add handler for create account button
                        $('#create-account-btn').click(function() {
                            // Switch to signup form and prefill email
                            $('#login-form').hide();
                            $('#signup-form').show();
                            $('#authModalLabel').text('Sign Up');
                            $('#auth-error').hide();
                            
                            // Pre-fill the email field
                            $('#reg-email').val(email);
                        });
                    } 
                    else if (error.code === 'auth/wrong-password') {
                        // Wrong password
                        $('#auth-error').html(`
                            <div class="d-flex align-items-center justify-content-between">
                                <div>
                                    <i class="fas fa-exclamation-circle text-danger me-2"></i>
                                    <span>${getAuthErrorMessage(error.code)}</span>
                                </div>
                                <button type="button" class="btn btn-sm btn-outline-secondary" id="forgot-password-btn">
                                    Reset Password
                                </button>
                            </div>
                        `).show();
                        
                        // Add handler for forgot password button
                        $('#forgot-password-btn').click(function() {
                            // Show password reset form
                            $('#signin-form').hide();
                            $('#auth-error').hide();
                            $('#auth-success').html(`
                                <div class="password-reset-form">
                                    <h4 class="mb-3">Reset Your Password</h4>
                                    <p class="mb-3">Enter your email address and we'll send you a link to reset your password.</p>
                                    <div class="mb-3">
                                        <input type="email" class="form-control" id="reset-email" value="${email}" required>
                                    </div>
                                    <div class="d-grid gap-2">
                                        <button type="button" class="btn btn-primary" id="send-reset-btn">
                                            Send Reset Link
                                        </button>
                                        <button type="button" class="btn btn-outline-secondary" id="cancel-reset-btn">
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            `).removeClass('alert-warning alert-success').addClass('alert-info').show();
                            
                            // Add handlers for password reset buttons
                            $('#send-reset-btn').click(function() {
                                const resetEmail = $('#reset-email').val();
                                if (!resetEmail) {
                                    alert('Please enter your email address');
                                    return;
                                }
                                
                                // Show loading
                                $(this).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Sending...').prop('disabled', true);
                                
                                // Send password reset email
                                firebase.auth().sendPasswordResetEmail(resetEmail)
                                    .then(() => {
                                        // Show success message
                                        $('#auth-success').html(`
                                            <div class="text-center">
                                                <i class="fas fa-envelope verification-icon mb-3"></i>
                                                <h4>Password Reset Email Sent!</h4>
                                                <p>We've sent a password reset link to <strong>${resetEmail}</strong></p>
                                                <p>Please check your inbox and follow the instructions to reset your password.</p>
                                                <button type="button" class="btn btn-outline-primary mt-3" id="back-to-login-btn">
                                                    Back to Sign In
                                                </button>
                                            </div>
                                        `).removeClass('alert-info').addClass('alert-success');
                                        
                                        // Add handler for back to login button
                                        $('#back-to-login-btn').click(function() {
                                            $('#auth-success').hide();
                                            $('#signin-form').show();
                                            $('#signin-form')[0].reset();
                                            $('#signin-btn').html('Sign In').prop('disabled', false);
                                        });
                                    })
                                    .catch((error) => {
                                        $('#send-reset-btn').html('Send Reset Link').prop('disabled', false);
                                        $('#auth-error').text(getAuthErrorMessage(error.code)).show();
                                        console.error("Error sending password reset:", error);
                                    });
                            });
                            
                            $('#cancel-reset-btn').click(function() {
                                $('#auth-success').hide();
                                $('#signin-form').show();
                            });
                        });
                    }
                    else {
                        // Handle other errors with standard message
                        $('#auth-error').html(`
                            <i class="fas fa-exclamation-circle text-danger me-2"></i>
                            ${getAuthErrorMessage(error.code)}
                        `).show();
                    }
                    
                    console.error("Login error:", error);
                });
            });
            
            // Handle registration form submission
            $('#register-form').submit(function(e) {
                e.preventDefault();
                
                const email = $('#reg-email').val();
                const password = $('#reg-password').val();
                const confirmPassword = $('#confirm-password').val();
                
                // Clear error messages
                $('#auth-error').hide().text('');
                $('#auth-success').hide().text('');
                
                // Validate passwords match
                if (password !== confirmPassword) {
                    $('#auth-error').text('Passwords do not match').show();
                    return;
                }
                
                // Validate password length
                if (password.length < 6) {
                    $('#auth-error').text('Password must be at least 6 characters').show();
                    return;
                }
                
                // Show loading indicator
                $('#register-btn').html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Creating account...').prop('disabled', true);
                
                // Create user with email and password
                firebase.auth().createUserWithEmailAndPassword(email, password)
                    .then((userCredential) => {
                        // Send email verification
                        return userCredential.user.sendEmailVerification()
                            .then(() => {
                                // Sign the user out - they must verify email before logging in
                                return firebase.auth().signOut();
                            })
                            .then(() => {
                                // Show success message
                                $('#register-form').hide();
                                $('#auth-success')
                                    .html(`
                                        <div class="text-center">
                                            <i class="fas fa-envelope-open-text verification-icon mb-3"></i>
                                            <h4>Verification Email Sent!</h4>
                                            <p>We've sent a verification link to <strong>${email}</strong></p>
                                            <p>Please check your inbox and click the link to verify your email address.</p>
                                            <p class="small mt-3">Once verified, you can <a href="#" id="go-to-login">sign in here</a>.</p>
                                        </div>
                                    `)
                                    .show();
                                
                                // Add event handler for the "sign in here" link
                                $('#go-to-login').click(function(e) {
                                    e.preventDefault();
                                    // Reset the form
                                    $('#register-form')[0].reset();
                                    $('#register-btn').html('Sign Up').prop('disabled', false);
                                    // Switch to login form
                                    $('#signup-form').hide();
                                    $('#login-form').show();
                                    $('#authModalLabel').text('Sign In');
                                    $('#auth-success').hide();
                                });
                            });
                    })
                    .catch((error) => {
                        // Reset button
                        $('#register-btn').html('Sign Up').prop('disabled', false);
                        
                        // Handle errors
                        const errorMessage = getAuthErrorMessage(error.code);
                        $('#auth-error').text(errorMessage).show();
                        console.error("Registration error:", error);
                    });
            });
            
            // Handle Google sign in
            $('#google-signin-btn').click(function(e) {
                e.preventDefault();
                
                // Clear error messages
                $('#auth-error').hide().text('');
                
                // Store original button content for restoring later
                const originalContent = $(this).html();
                
                // Show loading state
                $(this).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Connecting...').prop('disabled', true);
                
                const provider = new firebase.auth.GoogleAuthProvider();
                
                // Optional: Specify additional OAuth scopes if needed
                // provider.addScope('https://www.googleapis.com/auth/contacts.readonly');
                
                // Sign in with popup
                firebase.auth().signInWithPopup(provider)
                    .then((result) => {
                        // Close the modal
                        const authModal = bootstrap.Modal.getInstance(document.getElementById('authModal'));
                        if (authModal) {
                            authModal.hide();
                        }
                        
                        // Reset button state
                        $(this).html(originalContent).prop('disabled', false);
                    })
                    .catch((error) => {
                        // Reset button state
                        $(this).html(originalContent).prop('disabled', false);
                        
                        // Handle errors
                        const errorMessage = getAuthErrorMessage(error.code) || 'Error signing in with Google';
                        $('#auth-error').text(errorMessage).show();
                        console.error("Google sign-in error:", error);
                    });
            });
            
            // Handle logout button click
            $('#logout-button').click(function(e) {
                e.preventDefault();
                // Show confirmation modal instead of logging out immediately
                $('#logoutConfirmModal').modal('show');
            });
            
            // Handle confirmed logout
            $('#confirm-logout-btn').click(function() {
                // Close the modal
                $('#logoutConfirmModal').modal('hide');
                
                // Perform actual logout
                firebase.auth().signOut().catch((error) => {
                    console.error("Logout error:", error);
                });
            });
            
            // Translate Firebase auth error codes to user-friendly messages
            function getAuthErrorMessage(errorCode) {
                switch (errorCode) {
                    // Email/password errors
                    case 'auth/invalid-email':
                        return 'The email address format is invalid. Please check and try again.';
                    case 'auth/user-disabled':
                        return 'This account has been disabled. Please contact support.';
                    case 'auth/user-not-found':
                        return 'No account found with this email address. Please check your email or create a new account.';
                    case 'auth/wrong-password':
                        return 'Incorrect password. Please try again or use the password reset option.';
                    case 'auth/email-already-in-use':
                        return 'This email address is already registered. Please sign in instead.';
                    case 'auth/weak-password':
                        return 'Password is too weak. Please use at least 6 characters with a mix of letters, numbers, and symbols.';
                    case 'auth/requires-recent-login':
                        return 'For security reasons, please sign in again to continue.';
                    
                    // Google auth errors
                    case 'auth/account-exists-with-different-credential':
                        return 'An account already exists with this email but using a different sign-in method. Please use that method instead.';
                    case 'auth/popup-blocked':
                        return 'Sign-in popup was blocked by your browser. Please allow popups for this site and try again.';
                    case 'auth/popup-closed-by-user':
                        return 'Sign-in was canceled because the popup was closed. Please try again.';
                    case 'auth/cancelled-popup-request':
                        return 'The sign-in process was canceled. Please try again.';
                    case 'auth/credential-already-in-use':
                        return 'This account is already in use by another user. Please use a different account.';
                    
                    // Network errors
                    case 'auth/network-request-failed':
                        return 'Network error occurred. Please check your internet connection and try again.';
                    case 'auth/timeout':
                        return 'The operation timed out. Please try again when you have a better connection.';
                    
                    // General errors
                    case 'auth/operation-not-allowed':
                        return 'This sign-in method is not enabled. Please contact support.';
                    case 'auth/invalid-credential':
                        return 'The authentication credentials are invalid. Please try again.';
                    case 'auth/too-many-requests':
                        return 'Too many unsuccessful login attempts. Please try again later or reset your password.';
                    case 'auth/internal-error':
                        return 'An internal authentication error occurred. Please try again later.';
                    default:
                        return `Authentication error: ${errorCode || 'Unknown error'}. Please try again.`;
                }
            }
            
            // Load user's chat history from Firebase
            // Function to load user chat history from Firestore
            // Implementation below
            
            // Initialize UI elements
            initializeUI();
            
            function initializeAuthUI() {
                // Reset forms when modal is closed
                $('#authModal').on('hidden.bs.modal', function () {
                    $('#signin-form')[0].reset();
                    $('#register-form')[0].reset();
                    $('#auth-error').hide().text('');
                    $('#login-form').show();
                    $('#signup-form').hide();
                    $('#authModalLabel').text('Sign In');
                });
            }
            
            function initializeUI() {
                // Mobile sidebar toggle
                $('#sidebar-toggle, #mobile-sidebar-toggle').click(function() {
                    $('#sidebar').toggleClass('active');
                    $('#sidebar-backdrop').toggleClass('active');
                });
                
                // Close sidebar when clicking outside on mobile
                $('#sidebar-backdrop').click(function() {
                    $('#sidebar').removeClass('active');
                    $('#sidebar-backdrop').removeClass('active');
                });
                
                // Settings panel toggle
                $('#settings-icon').click(function(e) {
                    e.preventDefault();
                    $('#settings-panel').addClass('active');
                });
                
                // Close settings
                $('#close-settings').click(function() {
                    $('#settings-panel').removeClass('active');
                });
                
                // New chat button
                $('#new-chat-btn').click(function() {
                    createNewChat();
                });
                
                // Handle suggestion clicks
                $('.suggestion-item').click(function() {
                    const suggestion = $(this).find('p').text().replace(/"/g, '');
                    const serviceType = $(this).data('service');
                    
                    // Set the input value to the suggestion
                    $('#user-input').val(suggestion);
                    
                    // Switch to the appropriate service type
                    if (serviceType) {
                        $('#ai-service').val(serviceType).trigger('change');
                    }
                    
                    // Hide welcome screen
                    $('#welcome-screen').hide();
                    
                    // Focus on the input
                    $('#user-input').focus();
                });
                
                // Toggle settings panel visibility (legacy support)
                $('#toggle-settings').click(function() {
                    $('#settings-body').slideToggle(200);
                    $('.settings-toggle-icon').toggleClass('active');
                });

                // Profile link handler
                $('#profile-link').click(function(e) {
                    e.preventDefault();
                    showProfilePage();
                });
            }
            
            // Create a new chat session
            function createNewChat() {
                console.log("Creating new chat");
                
                // Hide welcome screen if visible
                $('#welcome-screen').hide();
                
                // Clear chat history
                chatHistory = [];
                
                // Clear chat interface
                $('#chat-body').html('');
                
                // Add initial message
                const initialMessage = {
                    role: 'assistant',
                    content: 'Hello! I\'m your AI assistant. How can I help you today?'
                };
                chatHistory.push(initialMessage);
                addMessage(initialMessage.content, false);
                
                // Update chat title
                $('#current-chat-title').text('New Chat');
                
                // Create a unique chat ID
                currentChatId = currentUser ? db.collection('users').doc(currentUser.uid).collection('chats').doc().id : 'chat_' + Date.now();
                
                console.log("Created new chat with ID:", currentChatId);
                
                // Create the chat in Firestore
                if (currentUser) {
                    console.log("Saving new chat to Firestore for user:", currentUser.uid);
                    
                    // First check if we need to delete old chats
                    manageChatLimit().then(() => {
                        // Now save the new chat
                        db.collection('users').doc(currentUser.uid).collection('chats').doc(currentChatId).set({
                            title: 'New Chat',
                            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                            messages: [initialMessage],
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        })
                        .then(() => {
                            console.log("New chat created successfully in Firestore");
                            
                            // Add to local chat sessions
                            chatSessions.push({
                                id: currentChatId,
                                title: 'New Chat',
                                date: new Date(),
                                messages: chatHistory.slice()
                            });
                            
                            // Update sidebar
                            updateChatSidebar();
                        })
                        .catch((error) => {
                            console.error("Error creating new chat in Firestore:", error);
                        });
                    });
                } else {
                    // Offline mode, just add to local sessions
                    console.log("Offline mode: Adding chat to local sessions only");
                    chatSessions.push({
                        id: currentChatId,
                        title: 'New Chat',
                        date: new Date(),
                        messages: chatHistory.slice()
                    });
                    
                    // Update sidebar
                    updateChatSidebar();
                }
                
                // Focus the input
                $('#user-input').focus();
            }
            
            // Manage chat limit to keep only MAX_SAVED_CHATS
            async function manageChatLimit() {
                if (!currentUser) return Promise.resolve();
                
                // Get all chats, sorted by lastUpdated
                return db.collection('users').doc(currentUser.uid).collection('chats')
                    .orderBy('lastUpdated', 'desc')
                    .get()
                    .then((querySnapshot) => {
                        if (querySnapshot.size >= MAX_SAVED_CHATS) {
                            // Delete oldest chats beyond the limit
                            const chatsToDelete = querySnapshot.docs.slice(MAX_SAVED_CHATS - 1);
                            
                            // Create a batch for efficient deletes
                            const batch = db.batch();
                            chatsToDelete.forEach(doc => {
                                batch.delete(doc.ref);
                            });
                            
                            return batch.commit();
                        }
                        return Promise.resolve();
                    });
            }
            
            // Delete a chat from Firestore and local state
            function deleteChat(chatId) {
                if (!chatId) return;
                
                // If currently viewing this chat, create a new one
                const isCurrentChat = currentChatId === chatId;
                
                // Remove from local state
                chatSessions = chatSessions.filter(session => session.id !== chatId);
                
                // Remove from Firestore if user is logged in
                if (currentUser) {
                    db.collection('users').doc(currentUser.uid).collection('chats').doc(chatId).delete()
                        .then(() => {
                            console.log("Chat deleted successfully");
                        })
                        .catch((error) => {
                            console.error("Error deleting chat:", error);
                        });
                }
                
                // Update sidebar
                updateChatSidebar();
                
                // If we deleted the current chat, create a new one or load another
                if (isCurrentChat) {
                    if (chatSessions.length > 0) {
                        // Load the first chat
                        loadChatSession(chatSessions[0].id);
                    } else {
                        // Create a new chat if no chats left
                        createNewChat();
                    }
                }
            }
            
            // Update the chat history in the sidebar
            function updateChatSidebar() {
                console.log("Updating chat sidebar with", chatSessions.length, "chats");
                
                // Clear existing history items
                $('#chat-history-items').empty();
                
                // Show no history message if no chats
                if (chatSessions.length === 0) {
                    console.log("No chat sessions available, showing no-history message");
                    toggleNoHistoryMessage(true);
                    return;
                }
                
                // Hide no history message
                toggleNoHistoryMessage(false);
                
                console.log("Chat sessions before sorting:", chatSessions);
                
                // Add all sessions to the sidebar (most recent first)
                chatSessions.sort((a, b) => {
                    // Ensure we have valid date objects
                    const dateA = a.date instanceof Date ? a.date : new Date(a.date || 0);
                    const dateB = b.date instanceof Date ? b.date : new Date(b.date || 0);
                    return dateB - dateA;
                }).forEach(session => {
                    console.log("Adding chat to sidebar:", session.id, session.title);
                    
                    const item = $('<div></div>')
                        .addClass('chat-history-item')
                        .attr('data-chat-id', session.id)
                        .html(`
                            <i class="far fa-comment-dots"></i>
                            <span>${session.title}</span>
                            <div class="chat-item-actions">
                                <button class="chat-action-btn chat-delete-btn" data-chat-id="${session.id}" title="Delete chat">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        `);
                        
                    // Highlight the current chat
                    if (session.id === currentChatId) {
                        item.addClass('active');
                    }
                    
                    // Add to sidebar
                    $('#chat-history-items').append(item);
                });
                
                // Add click handlers after all items are added
                $('.chat-history-item').click(function(e) {
                    // Don't trigger if clicking delete button
                    if ($(e.target).closest('.chat-action-btn').length) {
                        return;
                    }
                    const chatId = $(this).attr('data-chat-id');
                    console.log("Chat item clicked:", chatId);
                    loadChatSession(chatId);
                });
                
                // Add delete button handlers
                $('.chat-delete-btn').click(function(e) {
                    e.stopPropagation();
                    const chatId = $(this).attr('data-chat-id');
                    console.log("Delete button clicked for chat:", chatId);
                    
                    if (confirm('Are you sure you want to delete this chat?')) {
                        deleteChat(chatId);
                    }
                });
                
                console.log("Chat sidebar updated, items:", $('.chat-history-item').length);
            }
            
            // Load a previous chat session
            function loadChatSession(chatId) {
                console.log("Loading chat session:", chatId);
                
                // First check if we have the session in local state
                let session = chatSessions.find(s => s.id === chatId);
                
                // If not found and user is logged in, try to fetch from Firestore
                if (!session && currentUser) {
                    console.log("Session not found in local state, fetching from Firestore");
                    // Show loading indicator
                    $('#chat-body').html('<div class="thinking">Loading chat<div class="dots"><span></span><span></span><span></span></div></div>');
                    
                    // Fetch from Firestore
                    db.collection('users').doc(currentUser.uid).collection('chats').doc(chatId).get()
                        .then((doc) => {
                            if (doc.exists) {
                                console.log("Document found in Firestore:", doc.id);
                                const chatData = doc.data();
                                session = {
                                    id: doc.id,
                                    title: chatData.title || 'Untitled Chat',
                                    messages: chatData.messages || [],
                                    date: chatData.lastUpdated?.toDate() || new Date()
                                };
                                
                                console.log("Messages in session:", session.messages.length);
                                
                                // Add to local sessions if not already there
                                if (!chatSessions.some(s => s.id === chatId)) {
                                    chatSessions.push(session);
                                }
                                
                                // Now load the session
                                displayChatSession(session);
                            } else {
                                console.error("Chat not found");
                                $('#chat-body').html('<div class="alert alert-danger m-3">Chat not found</div>');
                            }
                        })
                        .catch((error) => {
                            console.error("Error loading chat:", error);
                            $('#chat-body').html('<div class="alert alert-danger m-3">Error loading chat</div>');
                        });
                } else if (session) {
                    console.log("Session found in local state, messages:", session.messages?.length);
                    // We have the session locally, display it
                    displayChatSession(session);
                } else {
                    console.error("Session not found and user not logged in");
                    $('#chat-body').html('<div class="alert alert-danger m-3">Chat not found</div>');
                }
            }
            
            // Helper function to display a chat session
            function displayChatSession(session) {
                // Update current chat ID
                currentChatId = session.id;
                
                // Clear chat interface
                $('#chat-body').html('');
                
                // Hide welcome screen
                $('#welcome-screen').hide();
                
                // Set the chat history
                chatHistory = session.messages.slice();
                
                console.log("Displaying chat session, messages:", chatHistory.length);
                
                // Display all messages
                session.messages.forEach((msg, index) => {
                    console.log(`Message ${index}:`, msg.role, typeof msg.content, msg.content.substring(0, 50) + "...");
                    
                    // Check if we need to format the message content
                    let content = msg.content;
                    
                    // For AI responses, format if not already formatted HTML
                    if (msg.role === 'assistant' && typeof content === 'string') {
                        // Check if the content appears to be HTML
                        const isHTML = content.includes('<p>') || 
                                      content.includes('<h1>') || 
                                      content.includes('<h2>') ||
                                      content.includes('<div') ||
                                      content.includes('<ul>') ||
                                      content.includes('<ol>') ||
                                      content.includes('<table>') ||
                                      content.includes('<blockquote>');
                                      
                        if (!isHTML) {
                            console.log("Formatting AI message that isn't HTML");
                            content = formatMessage(content);
                        }
                    }
                    
                    // Add message to chat body
                    addMessage(content, msg.role === 'user', false);
                });
                
                // Update chat title
                $('#current-chat-title').text(session.title);
                
                // Update sidebar to highlight current chat
                $('.chat-history-item').removeClass('active');
                $(`.chat-history-item[data-chat-id="${session.id}"]`).addClass('active');
                
                // On mobile, close the sidebar
                $('#sidebar').removeClass('active');
                $('#sidebar-backdrop').removeClass('active');
                
                // Focus the input
                $('#user-input').focus();
                
                // Scroll to bottom
                scrollToBottom();
            }
            
            // Handle settings tabs
            $('.settings-tab').click(function() {
                // Update active tab
                $('.settings-tab').removeClass('active');
                $(this).addClass('active');
                
                // Show appropriate content
                const tabId = $(this).data('tab');
                $('.settings-tab-content').removeClass('active');
                $('#' + tabId).addClass('active');
            });
            
            // Update service badge and show appropriate tab when service changes
            $('#ai-service').change(function() {
                const service = $(this).val();
                
                // Update placeholder
                if (service === 'text') {
                    $('#user-input').attr('placeholder', 'Type your message here...');
                    $('.settings-tab[data-tab="text-settings"]').click();
                } else if (service === 'audio') {
                    $('#user-input').attr('placeholder', 'Enter text to convert to speech...');
                    $('.settings-tab[data-tab="voice-settings"]').click();
                } else if (service === 'image') {
                    $('#user-input').attr('placeholder', 'Describe the image you want to generate...');
                    $('.settings-tab[data-tab="image-settings"]').click();
                }
            });
            
            // Focus the input field on load
            $('#user-input').focus();
            
            // Auto-resize textarea as user types
            function autoResizeTextarea() {
                const textarea = document.getElementById('user-input');
                
                // Reset height to auto to get the correct scrollHeight
                textarea.style.height = 'auto';
                
                // Set new height based on content (with max height constraint handled by CSS)
                textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
            }
            
            // Set up event listeners for textarea
            $('#user-input').on('input', autoResizeTextarea);
            
            // Reset height when form is submitted
            $('#message-form').on('submit', function() {
                setTimeout(function() {
                    const textarea = document.getElementById('user-input');
                    textarea.style.height = 'auto';
                }, 0);
            });
            
            // Add keyboard shortcut (Ctrl+Enter or Command+Enter to submit)
            $('#user-input').on('keydown', function(e) {
                if ((e.ctrlKey || e.metaKey) && e.keyCode === 13) {
                    $('#message-form').submit();
                    e.preventDefault();
                }
            });
            
            // Toggle system prompt textarea
            $('#customize-system').change(function() {
                $('#system-prompt').toggle(this.checked);
            });
            
            // Update model description when model is selected
            $('#model-select').change(function() {
                const selectedModel = $(this).val();
                const modelDescriptions = {
                    "openai": "Best for general purpose tasks and creative content",
                    "llama": "Open-source model with strong coding and reasoning abilities",
                    "mistral": "Efficient model with strong multilingual capabilities",
                    "searchgpt": "Enhanced with web search for up-to-date information",
                    "gemini": "Google's multimodal model with strong reasoning abilities",
                    "hormoz": "Specialized for technical and scientific content",
                    "deepseek": "Focused on deep information retrieval and research",
                    "qwen-reasoning": "Excels at complex problem-solving and step-by-step reasoning"
                };
                
                // Update description text
                $('#model-description').text(modelDescriptions[selectedModel] || "");
            }).trigger('change'); // Trigger on page load
            
            // Add message to chat
            function addMessage(content, isUser = false, addToHistory = true) {
                // Hide welcome screen if visible
                $('#welcome-screen').hide();
                
                const messageClass = isUser ? 'user-message' : 'ai-message';
                let originalContent = content; // Store the original content for saving
                
                // For AI messages, use the TextFormatter
                if (!isUser && typeof content === 'string') {
                    // Check if content is already HTML
                    if (!content.startsWith('<') || !content.endsWith('>')) {
                        content = formatMessage(content);
                        // Also update original content to keep the formatted version
                        originalContent = content;
                    }
                }
                
                const message = $('<div></div>').addClass(messageClass).html(content);
                $('#chat-body').append(message);
                scrollToBottom();
                
                // Add copy buttons to code blocks if this is an AI message
                if (!isUser) {
                    addCopyButtonsToCodeBlocks();
                }
                
                // Add to chat history for context (only for text messages)
                if (addToHistory && $('#ai-service').val() === 'text') {
                    // Create message object for chat history
                    const messageObj = { 
                        role: isUser ? "user" : "assistant", 
                        content: originalContent, // Use the original/formatted content
                        timestamp: new Date()
                    };
                    
                    // Exclude thinking indicators
                    if (originalContent !== '<div class="thinking">Thinking<div class="dots"><span></span><span></span><span></span></div></div>') {
                        chatHistory.push(messageObj);
                    }
                    
                    // Update session data if we have a current chat
                    if (currentChatId) {
                        const sessionIndex = chatSessions.findIndex(s => s.id === currentChatId);
                        if (sessionIndex !== -1) {
                            chatSessions[sessionIndex].messages = chatHistory.slice();
                            
                            // Update title if this is the first user message
                            let titleChanged = false;
                            if (isUser && chatSessions[sessionIndex].title === 'New Chat') {
                                // Use first 20 chars of user message as title - remove HTML
                                const tempDiv = document.createElement('div');
                                tempDiv.innerHTML = typeof content === 'string' ? content : '';
                                const plainText = tempDiv.textContent || tempDiv.innerText || 'Chat';
                                let title = plainText.substring(0, 20);
                                if (plainText.length > 20) title += '...';
                                chatSessions[sessionIndex].title = title;
                                
                                // Update title in the UI
                                $('#current-chat-title').text(title);
                                titleChanged = true;
                            }
                            
                            // Save to Firestore if user is logged in
                            if (currentUser) {
                                // Update the chat in Firestore
                                db.collection('users').doc(currentUser.uid).collection('chats').doc(currentChatId).update({
                                    messages: chatHistory.map(msg => ({
                                        role: msg.role,
                                        content: msg.content
                                    })),
                                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                                    title: chatSessions[sessionIndex].title
                                })
                                .then(() => {
                                    console.log("Chat updated successfully");
                                })
                                .catch((error) => {
                                    console.error("Error updating chat:", error);
                                });
                            }
                            
                            // Update sidebar if title changed
                            if (titleChanged) {
                                updateChatSidebar();
                            }
                        }
                    }
                }
            }
            
            // Add audio message to chat
            function addAudioMessage(audioData, text) {
                // Create a blob URL from the audio data
                const blob = new Blob([audioData], { type: 'audio/mpeg' });
                const audioUrl = URL.createObjectURL(blob);
                
                // Generate a unique ID for this audio player
                const audioId = 'audio-' + Math.floor(Math.random() * 1000000);
                
                // Create audio element with new design
                const audioElement = `
                    <div class="audio-message">
                        <div class="audio-header">
                            <div class="audio-icon">
                                <i class="fas fa-headphones"></i>
                            </div>
                            <div class="audio-info">
                                <div class="audio-title">Generated Audio</div>
                                <div class="audio-subtitle">Text-to-Speech by BKP3</div>
                            </div>
                        </div>
                        
                        <div class="audio-player-container">
                            <div class="custom-audio-player">
                                <button class="audio-play-button" data-audio-id="${audioId}">
                                    <i class="fas fa-play" id="${audioId}-play-icon"></i>
                                </button>
                                <div class="audio-progress-container">
                                    <div class="audio-progress">
                                        <div class="audio-progress-bar" id="${audioId}-progress"></div>
                                    </div>
                                </div>
                                <div class="audio-time" id="${audioId}-time">00:00 / 00:00</div>
                                <button class="audio-download" data-audio-url="${audioUrl}" title="Download audio">
                                    <i class="fas fa-download"></i>
                                </button>
                            </div>
                            <audio id="${audioId}" preload="metadata" style="display: none;">
                                <source src="${audioUrl}" type="audio/mpeg">
                                Your browser does not support the audio element.
                            </audio>
                        </div>
                        
                        <div class="audio-text">
                            "${text}"
                        </div>
                    </div>
                `;
                
                // Add to chat with a fade-in effect
                const message = $('<div></div>').addClass('ai-message').css('opacity', 0).html(audioElement);
                $('#chat-body').append(message);
                
                // Fade in the message
                message.animate({opacity: 1}, 400, function() {
                    // Add a subtle pulse effect to the play button to draw attention
                    const playButton = message.find('.audio-play-button');
                    playButton.addClass('pulse-once');
                    
                    // Remove the pulse class after animation completes
                    setTimeout(() => playButton.removeClass('pulse-once'), 1000);
                });
                
                scrollToBottom();
                
                // Initialize the custom audio player
                initializeAudioPlayer(audioId);
            }
            
            // Add a new function to initialize our custom audio player
            function initializeAudioPlayer(audioId) {
                const audio = document.getElementById(audioId);
                const playButton = document.querySelector(`button[data-audio-id="${audioId}"]`);
                const playIcon = document.getElementById(`${audioId}-play-icon`);
                const progressBar = document.getElementById(`${audioId}-progress`);
                const timeDisplay = document.getElementById(`${audioId}-time`);
                const downloadButton = playButton.parentElement.querySelector('.audio-download');
                
                // Format time in MM:SS format
                function formatTime(seconds) {
                    seconds = Math.floor(seconds);
                    const minutes = Math.floor(seconds / 60);
                    seconds = seconds % 60;
                    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }
                
                // Update progress and time display
                function updateProgress() {
                    const duration = audio.duration || 0;
                    const currentTime = audio.currentTime || 0;
                    const progress = (currentTime / duration) * 100 || 0;
                    
                    progressBar.style.width = `${progress}%`;
                    timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
                }
                
                // Toggle play/pause
                playButton.addEventListener('click', function() {
                    if (audio.paused) {
                        // Pause any other playing audio first
                        document.querySelectorAll('audio').forEach(a => {
                            if (a.id !== audioId && !a.paused) {
                                a.pause();
                                const otherIcon = document.getElementById(`${a.id}-play-icon`);
                                if (otherIcon) otherIcon.className = 'fas fa-play';
                            }
                        });
                        
                        audio.play();
                        playIcon.className = 'fas fa-pause';
                    } else {
                        audio.pause();
                        playIcon.className = 'fas fa-play';
                    }
                });
                
                // Download button event
                downloadButton.addEventListener('click', function() {
                    const link = document.createElement('a');
                    link.href = this.getAttribute('data-audio-url');
                    link.download = `BKP3-audio-${new Date().getTime()}.mp3`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                });
                
                // Update progress as audio plays
                audio.addEventListener('timeupdate', updateProgress);
                
                // When audio ends, reset play button
                audio.addEventListener('ended', function() {
                    playIcon.className = 'fas fa-play';
                });
                
                // Click on progress bar to seek
                const progressContainer = playButton.parentElement.querySelector('.audio-progress');
                progressContainer.addEventListener('click', function(e) {
                    const rect = this.getBoundingClientRect();
                    const pos = (e.clientX - rect.left) / rect.width;
                    audio.currentTime = pos * audio.duration;
                    updateProgress();
                });
                
                // Initialize time display once metadata is loaded
                audio.addEventListener('loadedmetadata', updateProgress);
            }
            
            // Show thinking animation
            function showThinking(serviceType = null) {
                let thinkingHtml;
                
                if (serviceType === 'audio') {
                    // Show specialized thinking animation for audio - with one text only
                    thinkingHtml = `
                        <div class="audio-loading">
                            <div class="generating-text">Generating audio</div>
                            <div class="spinner">
                                <div class="equalizer-animation">
                                    <div class="bar bar1"></div>
                                    <div class="bar bar2"></div>
                                    <div class="bar bar3"></div>
                                    <div class="bar bar4"></div>
                                    <div class="bar bar5"></div>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    // Standard thinking animation
                    thinkingHtml = `
                        <div class="thinking">Thinking<div class="dots"><span></span><span></span><span></span></div></div>
                    `;
                }
                
                const thinking = $(thinkingHtml);
                $('#chat-body').append(thinking);
                scrollToBottom();
                return thinking;
            }
            
            // Scroll chat to bottom
            function scrollToBottom() {
                const chatBody = document.getElementById('chat-body');
                chatBody.scrollTop = chatBody.scrollHeight;
            }
            
            // Format code blocks in responses
            function formatMessage(text) {
                // Use the TextFormatter to properly format different content types
                return TextFormatter.format(text);
            }
            
            // Simple HTML sanitizer to protect from XSS in AI responses
            function sanitizeHtml(html) {
                // This is a basic implementation - in production you might use a library like DOMPurify
                
                // Create a temporary element
                const tempElement = document.createElement('div');
                tempElement.innerHTML = html;
                
                // Remove potentially dangerous elements and attributes
                const dangerousElements = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'style'];
                const dangerousAttributes = ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onkeydown', 'onkeyup'];
                
                // Remove dangerous elements
                dangerousElements.forEach(tag => {
                    const elements = tempElement.getElementsByTagName(tag);
                    for (let i = elements.length - 1; i >= 0; i--) {
                        elements[i].parentNode.removeChild(elements[i]);
                    }
                });
                
                // Remove dangerous attributes from all elements
                const allElements = tempElement.getElementsByTagName('*');
                for (let i = 0; i < allElements.length; i++) {
                    const element = allElements[i];
                    dangerousAttributes.forEach(attr => {
                        if (element.hasAttribute(attr)) {
                            element.removeAttribute(attr);
                        }
                    });
                    
                    // Remove javascript: URLs
                    if (element.hasAttribute('href')) {
                        const href = element.getAttribute('href');
                        if (href.toLowerCase().indexOf('javascript:') === 0) {
                            element.setAttribute('href', '#');
                        }
                    }
                    
                    // Remove on* attributes
                    Array.from(element.attributes).forEach(attr => {
                        if (attr.name.toLowerCase().startsWith('on')) {
                            element.removeAttribute(attr.name);
                        }
                    });
                }
                
                return tempElement.innerHTML;
            }
            
            // Helper function to highlight syntax for specific languages
            function highlightSyntax(code, language) {
                // Apply basic syntax highlighting based on the language
                switch (language.toLowerCase()) {
                    case 'javascript':
                    case 'js':
                        // Highlight JavaScript syntax
                        return highlightJavaScript(code);
                    case 'python':
                    case 'py':
                        // Highlight Python syntax
                        return highlightPython(code);
                    case 'html':
                        // Highlight HTML syntax
                        return highlightHTML(code);
                    case 'css':
                        // Highlight CSS syntax
                        return highlightCSS(code);
                    case 'json':
                        // Highlight JSON syntax
                        return highlightJSON(code);
                    default:
                        // For other languages, return as is
                        return code;
                }
            }
            
            // JavaScript syntax highlighting
            function highlightJavaScript(code) {
                // Escape HTML to prevent issues
                code = escapeHtml(code);
                
                // Keywords
                const keywords = ['var', 'let', 'const', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'new', 'try', 'catch', 'throw', 'finally', 'class', 'extends', 'super', 'import', 'export', 'from', 'as', 'async', 'await', 'of', 'in'];
                
                // Special values
                const values = ['true', 'false', 'null', 'undefined', 'NaN', 'Infinity'];
                
                // Built-in objects
                const objects = ['Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'Math', 'RegExp', 'Map', 'Set', 'Promise', 'JSON'];
                
                // Apply highlighting
                code = code
                    // Highlight strings
                    .replace(/(["'])(.*?)\1/g, '<span class="code-string">$1$2$1</span>')
                    // Highlight comments
                    .replace(/\/\/(.*?)(?:\n|$)/g, '<span class="code-comment">//$1</span>\n')
                    .replace(/\/\*([\s\S]*?)\*\//g, '<span class="code-comment">/*$1*/</span>');
                
                // Highlight keywords
                keywords.forEach(keyword => {
                    const regex = new RegExp(`\\b${keyword}\\b`, 'g');
                    code = code.replace(regex, `<span class="code-keyword">${keyword}</span>`);
                });
                
                // Highlight values
                values.forEach(value => {
                    const regex = new RegExp(`\\b${value}\\b`, 'g');
                    code = code.replace(regex, `<span class="code-value">${value}</span>`);
                });
                
                // Highlight built-in objects
                objects.forEach(object => {
                    const regex = new RegExp(`\\b${object}\\b`, 'g');
                    code = code.replace(regex, `<span class="code-object">${object}</span>`);
                });
                
                // Highlight function calls
                code = code.replace(/(\w+)(\s*\()/g, '<span class="code-function">$1</span>$2');
                
                // Highlight numbers
                code = code.replace(/\b(\d+\.?\d*)\b/g, '<span class="code-number">$1</span>');
                
                return code;
            }
            
            // Python syntax highlighting
            function highlightPython(code) {
                // Escape HTML to prevent issues
                code = escapeHtml(code);
                
                // Keywords
                const keywords = ['def', 'class', 'import', 'from', 'as', 'return', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'with', 'pass', 'break', 'continue', 'and', 'or', 'not', 'is', 'in', 'lambda', 'global', 'nonlocal', 'True', 'False', 'None', 'raise'];
                
                // Apply highlighting
                code = code
                    // Highlight strings
                    .replace(/(["'])(.*?)\1/g, '<span class="code-string">$1$2$1</span>')
                    // Highlight triple-quoted strings
                    .replace(/(?:""")([\s\S]*?)(?:""")/g, '<span class="code-string">"""$1"""</span>')
                    .replace(/(?:''')/g, '<span class="code-string">\'\'\'</span>')
                    // Highlight comments
                    .replace(/#(.*?)(?:\n|$)/g, '<span class="code-comment">#$1</span>\n');
                
                // Highlight keywords
                keywords.forEach(keyword => {
                    const regex = new RegExp(`\\b${keyword}\\b`, 'g');
                    code = code.replace(regex, `<span class="code-keyword">${keyword}</span>`);
                });
                
                // Highlight function definitions
                code = code.replace(/\b(def)\s+(\w+)(\s*\()/g, '<span class="code-keyword">def</span> <span class="code-function">$2</span>$3');
                
                // Highlight class definitions
                code = code.replace(/\b(class)\s+(\w+)/g, '<span class="code-keyword">class</span> <span class="code-class">$2</span>');
                
                // Highlight numbers
                code = code.replace(/\b(\d+\.?\d*)\b/g, '<span class="code-number">$1</span>');
                
                return code;
            }
            
            // HTML syntax highlighting
            function highlightHTML(code) {
                // Escape HTML to prevent issues
                code = escapeHtml(code);
                
                // Highlight tags
                code = code
                    .replace(/(&lt;[\/]?)([\w\-]+)/g, '$1<span class="code-tag">$2</span>')
                    .replace(/(&lt;)([\/]?[\w\-]+)([^&>]*?)(&gt;)/g, '<span class="code-bracket">$1</span><span class="code-tag">$2</span>$3<span class="code-bracket">$4</span>')
                    // Highlight attributes
                    .replace(/(\s+)([\w\-]+)=(".*?"|'.*?')/g, '$1<span class="code-attribute">$2</span>=<span class="code-string">$3</span>');
                
                return code;
            }
            
            // CSS syntax highlighting
            function highlightCSS(code) {
                // Escape HTML to prevent issues
                code = escapeHtml(code);
                
                // Highlight CSS
                code = code
                    // Highlight selectors
                    .replace(/([.#][\w\-]+)/g, '<span class="code-selector">$1</span>')
                    // Highlight properties
                    .replace(/([\w\-]+)(\s*:)/g, '<span class="code-property">$1</span>$2')
                    // Highlight values
                    .replace(/(:)(\s*)([\w\-#]+)/g, '$1$2<span class="code-value">$3</span>')
                    // Highlight units
                    .replace(/(\d+)(px|em|rem|%|vh|vw|s|ms)/g, '<span class="code-number">$1</span><span class="code-unit">$2</span>')
                    // Highlight comments
                    .replace(/\/\*([\s\S]*?)\*\//g, '<span class="code-comment">/*$1*/</span>');
                
                return code;
            }
            
            // JSON syntax highlighting
            function highlightJSON(code) {
                // Escape HTML to prevent issues
                code = escapeHtml(code);
                
                // Highlight JSON
                code = code
                    // Highlight strings and keys
                    .replace(/(".*?")(\s*:)/g, '<span class="code-key">$1</span>$2')
                    .replace(/(".*?")/g, '<span class="code-string">$1</span>')
                    // Highlight boolean and null
                    .replace(/\b(true|false|null)\b/g, '<span class="code-value">$1</span>')
                    // Highlight numbers
                    .replace(/\b(\d+\.?\d*)\b/g, '<span class="code-number">$1</span>');
                
                return code;
            }
            
            // Helper function to escape HTML
            function escapeHtml(text) {
                return text
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
            }
            
            // Add copy buttons to all code blocks in a message
            function addCopyButtonsToCodeBlocks() {
                // Find all code blocks with copy buttons
                $('.ai-message .code-block').each(function() {
                    const codeBlock = $(this);
                    // Skip if already processed
                    if (codeBlock.data('copy-initialized')) {
                        return;
                    }
                    
                    // Mark as processed
                    codeBlock.data('copy-initialized', true);
                    
                    // Find the copy button
                    const copyButton = codeBlock.find('.copy-code-button');
                    
                    // Find all code lines and join them
                    const codeContent = codeBlock.find('.code-line')
                        .map(function() {
                            // Get the indentation from data attribute
                            const indent = $(this).attr('data-indent') || '';
                            // Convert non-breaking spaces back to regular spaces
                            const indentSpaces = indent.replace(/\u00A0/g, ' ');
                            // Get the visible content
                            const content = $(this).text();
                            // Combine indentation and content
                            return indentSpaces + content;
                        })
                        .get()
                        .join('\n');
                    
                    // Add click handler
                    copyButton.on('click', function() {
                        // Copy the code to clipboard
                        navigator.clipboard.writeText(codeContent).then(function() {
                            // Show "Copied!" feedback
                            copyButton.html('<i class="fas fa-check"></i> Copied!');
                            
                            // Reset after 2 seconds
                            setTimeout(function() {
                                copyButton.html('<i class="far fa-copy"></i> Copy');
                            }, 2000);
                        }).catch(function(err) {
                            console.error('Failed to copy text: ', err);
                            copyButton.html('<i class="fas fa-times"></i> Error!');
                            
                            // Reset after 2 seconds
                            setTimeout(function() {
                                copyButton.html('<i class="far fa-copy"></i> Copy');
                            }, 2000);
                        });
                    });
                });
            }
            
            // Generate a simulated response for local mode
            function getSimulatedResponse(prompt, serviceType) {
                if (serviceType === 'audio') {
                    return `[This would be audio in production mode] Text: "${prompt}"`;
                }
                
                // Get selected model
                const selectedModel = $('#model-select').val();
                
                // Add model-specific responses
                const modelSpecificResponses = {
                    "openai": "<p>I'm using OpenAI's model to generate this simulated response.</p>",
                    "llama": "<p>As a Llama model, I would answer your query with high efficiency.</p>",
                    "mistral": "<p>Mistral AI here! I would provide a detailed response to your question.</p>",
                    "searchgpt": "<p>SearchGPT would fetch relevant web results to enhance my answer.</p>",
                    "gemini": "<p>Gemini model responding with a multimodal perspective on your query.</p>",
                    "hormoz": "<p>Hormoz AI at your service! I specialize in precise technical information.</p>",
                    "deepseek": "<p>DeepSeek model here, focusing on deep information retrieval for your query.</p>",
                    "qwen-reasoning": "<p>Qwen Reasoning model would apply step-by-step logical reasoning to address your question.</p>"
                };
                
                const responses = {
                    "hello": "<p>Hello! How can I assist you today?</p>",
                    "hi": "<p>Hi there! What can I help you with?</p>",
                    "how are you": "<p>I'm just a program, but I'm functioning well! How can I help you?</p>",
                    "what is your name": "<p>I'm the BKP3 AI Assistant, a demonstration of the BKP3 API.</p>",
                    "help": "<h2>Help</h2><p>I can answer questions, provide information, write content, and more! What would you like help with?</p><ul><li>Ask me questions</li><li>Request code examples</li><li>Get creative content</li><li>And much more!</li></ul>",
                    "what time is it": "<p>I don't have access to your local time. Your device's clock would have that information.</p>",
                    "what's the weather": "<p>I don't have access to real-time weather data. You could check a weather service or look outside!</p>",
                    "tell me a joke": "<p>Why don't scientists trust atoms? Because they make up everything!</p>",
                    "write a poem": "<div class='poetry'>Roses are red,<br>Violets are blue,<br>I'm just a demo,<br>But I'd love to help you!</div>",
                    "thank you": "<p>You're welcome! Let me know if there's anything else you need help with.</p>",
                    "bye": "<p>Goodbye! Feel free to come back if you have more questions.</p>",
                    "what can you do": "<h2>My Capabilities</h2><p>In this demo mode, I can provide simulated responses to show how the interface works. With the real API, I could:</p><ul><li>Answer questions</li><li>Generate text</li><li>Help with coding</li><li>Provide creative content</li><li>And much more!</li></ul>"
                };
                
                // Check for exact matches
                let lowercasePrompt = prompt.toLowerCase().trim();
                if (responses[lowercasePrompt]) {
                    // Add model prefix to known responses
                    return modelSpecificResponses[selectedModel] + responses[lowercasePrompt];
                }
                
                // Check for partial matches
                for (const key in responses) {
                    if (lowercasePrompt.includes(key)) {
                        return modelSpecificResponses[selectedModel] + responses[key];
                    }
                }
                
                // Default response with model info and more structured HTML
                return `<div>
                ${modelSpecificResponses[selectedModel]}
                <p>This is a simulated response in demo mode. With the real API, I would provide a real answer to your query: '${prompt}'.</p>
                <p>To use the real API, you'll need to run this on a server or deploy it online.</p>
                </div>`;
            }
            
            // Process text-to-speech request
            function processTextToSpeech(text) {
                // Get voice settings
                const voice = $('#voice-select').val();
                const vibe = $('#vibe-select').val();
                
                // Show specialized thinking animation for audio
                const thinking = showThinking('audio');
                
                if (isLocalMode) {
                    // Simulate audio response in local mode with a realistic delay
                    setTimeout(function() {
                        // Show progress animation - speed up the equalizer
                        thinking.find('.equalizer-animation .bar').css({
                            'animation-duration': '0.6s',
                            'animation-timing-function': 'ease-in-out'
                        });
                        
                        setTimeout(function() {
                            // Create mock audio player for demo mode
                            const mockAudioElement = `
                                <div class="audio-message">
                                    <div class="audio-header">
                                        <div class="audio-icon">
                                            <i class="fas fa-headphones"></i>
                                        </div>
                                        <div class="audio-info">
                                            <div class="audio-title">Generated Audio (Demo)</div>
                                            <div class="audio-subtitle">Voice: ${$('#voice-select option:selected').text()}, Vibe: ${vibe}</div>
                                        </div>
                                    </div>
                                    
                                    <div class="audio-player-container">
                                        <div class="custom-audio-player">
                                            <button class="audio-play-button" disabled>
                                                <i class="fas fa-play"></i>
                                            </button>
                                            <div class="audio-progress-container">
                                                <div class="audio-progress">
                                                    <div class="audio-progress-bar" style="width: 0%"></div>
                                                </div>
                                            </div>
                                            <div class="audio-time">00:00 / 00:00</div>
                                            <button class="audio-download" disabled title="Download audio">
                                                <i class="fas fa-download"></i>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div class="audio-text">
                                        "${text}"
                                    </div>
                                </div>
                            `;
                            
                            // Remove the thinking indicator and add the audio message
                            thinking.fadeOut(300, function() {
                                $(this).remove();
                                const message = $('<div></div>').addClass('ai-message').html(mockAudioElement);
                                $('#chat-body').append(message);
                                scrollToBottom();
                            });
                        }, 1800);
                    }, 1200);
                    return;
                }
                
                // Prepare request for audio generation
                const requestData = {
                    text: text,
                    voice: voice,
                    vibe: vibe,
                    userId: currentUser ? currentUser.uid : null
                };
                
                // Make API request for audio
                $.ajax({
                    url: '/api/generate-audio',
                    method: 'POST',
                    data: JSON.stringify(requestData),
                    contentType: 'application/json',
                    processData: false,
                    responseType: 'arraybuffer',
                    xhrFields: {
                        responseType: 'arraybuffer'
                    }
                })
                .done(function(response) {
                    // Animate equalizer bars faster to indicate completion
                    thinking.find('.equalizer-animation .bar').css({
                        'animation-duration': '0.4s',
                        'animation-timing-function': 'linear'
                    });
                    
                    // Fade out the thinking animation and show the audio message
                    thinking.fadeOut(300, function() {
                        $(this).remove();
                        addAudioMessage(response, text);
                    });
                })
                .fail(function(jqXHR, textStatus, errorThrown) {
                    thinking.remove();
                    
                    // Log detailed error information
                    console.error("Audio API request failed:", {
                        status: jqXHR.status,
                        statusText: jqXHR.statusText,
                        responseText: jqXHR.responseText,
                        textStatus: textStatus,
                        errorThrown: errorThrown
                    });
                    
                    // Create error message
                    let errorMessage = "Sorry, I encountered an error generating the audio.<br>";
                    errorMessage += "Please check the browser console for details.";
                    
                    addMessage(errorMessage);
                });
            }
            
            // Add image message to chat
            function addImageMessage(imageData, prompt) {
                // Create a blob URL from the image data
                const blob = new Blob([imageData], { type: 'image/jpeg' });
                const imageUrl = URL.createObjectURL(blob);
                
                // Create image element
                const imageElement = `
                    <div class="image-message">
                        <img src="${imageUrl}" alt="Generated image" class="img-fluid rounded" style="max-height: 400px;">
                        <div class="text-muted small mt-1">Prompt: "${prompt}"</div>
                    </div>
                `;
                
                // Add to chat
                const message = $('<div></div>').addClass('ai-message').html(imageElement);
                $('#chat-body').append(message);
                scrollToBottom();
            }
            
            // Process image generation request
            function processImageGeneration(prompt) {
                // Show thinking animation
                const thinking = showThinking();
                
                // Get image settings
                const model = $('#image-model').val();
                const width = parseInt($('#width-input').val());
                const height = parseInt($('#height-input').val());
                const imageCount = parseInt($('#image-count').val());
                
                // Get base seed (if provided)
                let baseSeed = $('#seed-input').val().trim();
                baseSeed = baseSeed ? parseInt(baseSeed) : Math.floor(Math.random() * 1000000);
                
                if (isLocalMode) {
                    // Simulate image response in local mode
                    setTimeout(function() {
                        thinking.remove();
                        
                        // Create a container for multiple images
                        let imageGridHtml = `<div class="image-grid-${imageCount === 4 ? '2x2' : '1x2'}">`;
                        
                        // Generate placeholder images
                        for (let i = 0; i < imageCount; i++) {
                            // For demo mode, create different colored placeholders
                            const colors = ['#667eea,#764ba2', '#3f51b5,#2196f3', '#4caf50,#8bc34a', '#ff9800,#ff5722'];
                            imageGridHtml += `
                                <div class="image-grid-item">
                                    <div style="width: 100%; height: 100%; background: linear-gradient(45deg, ${colors[i % colors.length]}); 
                                                display: flex; align-items: center; justify-content: center; border-radius: 8px;">
                                        <div style="text-align: center; padding: 20px;">
                                            <i class="fas fa-image" style="font-size: 32px; color: white;"></i>
                                            <p style="margin-top: 10px; color: white;">Image ${i+1}</p>
                                            <small style="color: white;">Seed: ${baseSeed + i}</small>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }
                        
                        imageGridHtml += '</div>';
                        imageGridHtml += `<div class="text-muted small mt-2">Prompt: "${prompt}"</div>`;
                        
                        addMessage(imageGridHtml);
                    }, 1500);
                    return;
                }
                
                // Create a container for the images
                let containerMessage = $('<div></div>').addClass('ai-message');
                const imageGridHtml = `<div class="image-grid-${imageCount === 4 ? '2x2' : '1x2'}" data-prompt="${prompt}"></div>
                                      <div class="text-muted small mt-2">Prompt: "${prompt}"</div>`;
                containerMessage.html(imageGridHtml);
                $('#chat-body').append(containerMessage);
                scrollToBottom();
                
                // Get the grid container
                const imageGrid = containerMessage.find('.image-grid-1x2, .image-grid-2x2');
                
                // Create placeholders for all images
                for (let i = 0; i < imageCount; i++) {
                    const placeholderHtml = `
                        <div class="image-grid-item" id="image-placeholder-${i}">
                            <div class="image-placeholder">
                                <div class="placeholder-text">
                                    <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                    Generating image...
                                </div>
                            </div>
                            <div class="text-muted small mt-1">Seed: ${baseSeed + i}</div>
                        </div>
                    `;
                    imageGrid.append(placeholderHtml);
                }
                scrollToBottom();
                
                // Function to generate a single image with retries
                const generateSingleImage = (index, retryCount = 0) => {
                    return new Promise((resolve, reject) => {
                        // Calculate seed for this image
                        const seed = baseSeed + index;
                        
                        // Prepare request for image generation
                        const requestData = {
                            prompt: prompt,
                            width: width,
                            height: height,
                            seed: seed,
                            model: model,
                            userId: currentUser ? currentUser.uid : null
                        };
                        
                        // Make API request for image
                        $.ajax({
                            url: '/api/generate-image',
                            method: 'POST',
                            data: JSON.stringify(requestData),
                            contentType: 'application/json',
                            processData: false,
                            responseType: 'arraybuffer',
                            xhrFields: {
                                responseType: 'arraybuffer'
                            }
                        })
                        .done(function(response) {
                            // Create a blob URL from the image data
                            const blob = new Blob([response], { type: 'image/jpeg' });
                            const imageUrl = URL.createObjectURL(blob);
                            
                            // Create image element with click event for modal
                            const imageElement = `
                                <div class="image-grid-item">
                                    <img src="${imageUrl}" alt="Generated image" class="img-fluid rounded" 
                                         data-seed="${seed}" data-index="${index}" data-bs-toggle="modal" data-bs-target="#imageModal">
                                    <div class="text-muted small mt-1">Seed: ${seed}</div>
                                </div>
                            `;
                            
                            // Replace placeholder with actual image
                            $(`#image-placeholder-${index}`).replaceWith(imageElement);
                            scrollToBottom();
                            
                            resolve({success: true, index: index});
                        })
                        .fail(function(jqXHR, textStatus, errorThrown) {
                            console.error(`Image API request failed for index ${index}:`, {
                                status: jqXHR.status,
                                statusText: jqXHR.statusText,
                                responseText: jqXHR.responseText,
                                textStatus: textStatus,
                                errorThrown: errorThrown
                            });
                            
                            // If we hit a rate limit and have retries left, wait and try again
                            if (jqXHR.status === 429 && retryCount < 3) {
                                const retryDelay = (retryCount + 1) * 2000; // Increasing delay: 2s, 4s, 6s
                                
                                // Update placeholder to show retry status
                                $(`#image-placeholder-${index} .placeholder-text`).html(`
                                    <i class="fas fa-clock text-warning"></i>
                                    Rate limited. Retrying in ${retryDelay/1000}s...
                                `);
                                scrollToBottom();
                                
                                // Wait and try again
                                setTimeout(() => {
                                    $(`#image-placeholder-${index} .placeholder-text`).html(`
                                        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                        Retrying...
                                    `);
                                    resolve(generateSingleImage(index, retryCount + 1));
                                }, retryDelay);
                            } else {
                                // Replace placeholder with error message
                                const errorElement = `
                                    <div class="image-grid-item">
                                        <div class="text-danger p-3 border rounded">
                                            <i class="fas fa-exclamation-triangle"></i> Error: ${jqXHR.status === 429 ? 'Rate limit exceeded' : 'Failed to generate image'}
                                        </div>
                                        <div class="text-muted small mt-1">Seed: ${seed}</div>
                                    </div>
                                `;
                                $(`#image-placeholder-${index}`).replaceWith(errorElement);
                                scrollToBottom();
                                
                                resolve({success: false, index: index, error: {jqXHR, textStatus, errorThrown}});
                            }
                        });
                    });
                };
                
                // Process images sequentially with delay between requests
                async function processImagesSequentially() {
                    thinking.remove(); // Remove thinking indicator as we have our own progress display
                    
                    for (let i = 0; i < imageCount; i++) {
                        // Generate image
                        await generateSingleImage(i);
                        
                        // Add delay between requests to avoid rate limiting (skip delay for last image)
                        if (i < imageCount - 1) {
                            await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay between requests
                        }
                    }
                }
                
                // Start sequential processing
                processImagesSequentially().catch(err => {
                    console.error("Error in image processing:", err);
                });
            }
            
            // Helper function to handle image errors
            function handleImageError(error) {
                // Log detailed error information
                console.error("Image API request failed:", {
                    status: error.jqXHR.status,
                    statusText: error.jqXHR.statusText,
                    responseText: error.jqXHR.responseText,
                    textStatus: error.textStatus,
                    errorThrown: error.errorThrown
                });
                
                // Create error message
                let errorMessage = "Sorry, I encountered an error generating the image.<br>";
                errorMessage += "Please check the browser console for details.";
                
                addMessage(errorMessage);
            }
            
            // Add CSS for image grid layouts
            function addStyleToHead() {
                const styleElement = document.createElement('style');
                styleElement.textContent = `
                    .image-grid-1x2 {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 10px;
                        margin-bottom: 10px;
                    }
                    
                    .image-grid-2x2 {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        grid-template-rows: auto auto;
                        gap: 10px;
                        margin-bottom: 10px;
                    }
                    
                    .image-grid-item {
                        overflow: hidden;
                        border-radius: 8px;
                    }
                    
                    .image-grid-1x2 .image-grid-item {
                        flex: 0 0 calc(50% - 5px);
                        max-width: calc(50% - 5px);
                    }
                    
                    .image-grid-2x2 .image-grid-item img,
                    .image-grid-1x2 .image-grid-item img {
                        width: 100%;
                        height: auto;
                        object-fit: cover;
                        border-radius: 8px;
                    }
                    
                    @media (max-width: 576px) {
                        .image-grid-1x2, .image-grid-2x2 {
                            display: flex;
                            flex-direction: column;
                        }
                        
                        .image-grid-1x2 .image-grid-item {
                            flex: 0 0 100%;
                            max-width: 100%;
                            margin-bottom: 10px;
                        }
                        
                        .image-grid-2x2 .image-grid-item {
                            margin-bottom: 10px;
                        }
                    }
                `;
                document.head.appendChild(styleElement);
            }
            
            // Call at document ready
            addStyleToHead();
            
            // Handle form submission
            $('#message-form').submit(function(e) {
                e.preventDefault();
                
                // Ensure user is logged in
                if (!currentUser) {
                    const authModal = new bootstrap.Modal(document.getElementById('authModal'));
                    authModal.show();
                    return;
                }
                
                const userInput = $('#user-input').val().trim();
                if (!userInput) return;
                
                // Clear input and focus it again
                $('#user-input').val('').focus();
                
                // Ensure we have a current chat session
                if (!currentChatId) {
                    createNewChat();
                }
                
                // Add user message to chat
                addMessage(userInput, true);
                
                // Check which service is selected
                const serviceType = $('#ai-service').val();
                
                if (serviceType === 'audio') {
                    // Process text-to-speech request
                    processTextToSpeech(userInput);
                    return;
                } else if (serviceType === 'image') {
                    // Process image generation request
                    processImageGeneration(userInput);
                    return;
                }
                
                // Show thinking animation for text service
                const thinking = showThinking();
                
                // Get system prompt
                let systemPrompt = $('#customize-system').is(':checked') 
                    ? $('#system-prompt').val() 
                    : "You are a helpful assistant.";
                
                // Add instructions to format response in HTML when using Text AI
                if ($('#ai-service').val() === 'text') {
                    systemPrompt += "\n\nIMPORTANT: Format your responses in HTML when appropriate. Use <h1>, <h2>, <h3> for headings, <p> for paragraphs, <ul>/<ol> for lists, <blockquote> for quotes, <table> for tables, etc. For code blocks, use triple backticks with the language name:\n\n```javascript\nconsole.log('Hello world');\n// This preserves formatting\nif (condition) {\n    doSomething();\n}\n```\n\nPRESERVE EXACT INDENTATION AND LINE BREAKS IN CODE BLOCKS. Don't worry about HTML entities - the system will properly format and highlight the code.";
                }
                
                // Prepare messages including history for context
                const messages = [
                    { role: "system", content: systemPrompt },
                    ...chatHistory.slice(-10) // Keep last 10 messages for context
                ];
                
                // If in local mode, use simulated responses instead of real API
                if (isLocalMode) {
                    // Simulate network delay
                    setTimeout(function() {
                        thinking.remove();
                        const simulatedResponse = getSimulatedResponse(userInput, serviceType);
                        
                        // Add message (no formatting needed since the simulated response is already in HTML)
                        addMessage(simulatedResponse);
                    }, 1000);
                    return;
                }
                
                // API request settings for real mode
                const settings = {
                    async: true,
                    crossDomain: true,
                    url: '/api/generate-text',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify({
                        messages: messages,
                        model: $('#model-select').val(),
                        userId: currentUser ? currentUser.uid : null
                    })
                };
                
                // Make API request
                $.ajax(settings)
                    .done(function(response) {
                        // Remove thinking animation
                        thinking.remove();
                        
                        let responseText;
                        
                        // Log full response for debugging
                        console.log("API Response:", response);
                        
                        try {
                            // Parse response based on structure
                            if (typeof response === 'string') {
                                try {
                                    // Try to parse as JSON
                                    const jsonResponse = JSON.parse(response);
                                    if (jsonResponse.choices && jsonResponse.choices.length > 0) {
                                        responseText = jsonResponse.choices[0].message.content;
                                    } else if (jsonResponse.content) {
                                        responseText = jsonResponse.content;
                                    } else if (jsonResponse.text) {
                                        responseText = jsonResponse.text;
                                    } else {
                                        // Default to empty text response
                                        responseText = jsonResponse.text || "I'm not sure how to respond to that.";
                                    }
                                } catch (e) {
                                    // Not JSON, use as-is
                                    responseText = response;
                                }
                            } else if (response.choices && response.choices.length > 0) {
                                responseText = response.choices[0].message.content;
                            } else if (response.content) {
                                responseText = response.content;
                            } else if (response.text) {
                                responseText = response.text;
                            } else if (response.text !== undefined) {
                                // Handle empty text response
                                responseText = "I don't have a specific response for that query.";
                            } else {
                                // Default response
                                responseText = "I'm not sure how to respond to that.";
                            }
                            
                            // Sanitize HTML content to protect from XSS
                            responseText = sanitizeHtml(responseText);
                            
                            // Format and add AI message
                            addMessage(responseText);
                        } catch (error) {
                            console.error("Error processing response:", error);
                            addMessage("Sorry, I encountered an error processing the response. Please try again.");
                        }
                    })
                    .fail(function(jqXHR, textStatus, errorThrown) {
                        thinking.remove();
                        
                        // Log detailed error information
                        console.error("API request failed:", {
                            status: jqXHR.status,
                            statusText: jqXHR.statusText,
                            responseText: jqXHR.responseText,
                            textStatus: textStatus,
                            errorThrown: errorThrown
                        });
                        
                        // Create a more helpful error message
                        let errorMessage = "Sorry, I encountered an error while processing your request.<br>";
                        
                        if (jqXHR.status === 0) {
                            errorMessage += "Network error: Could not connect to the API server. This could be due to CORS restrictions, network connectivity issues, or the server being down.";
                        } else if (jqXHR.status === 401 || jqXHR.status === 403) {
                            errorMessage += "Authentication error: The API key might be invalid or expired.";
                        } else if (jqXHR.status === 404) {
                            errorMessage += "API endpoint not found. Please check the URL.";
                        } else if (jqXHR.status === 429) {
                            errorMessage += "Rate limit exceeded. The API is receiving too many requests.";
                        } else if (jqXHR.status >= 500) {
                            errorMessage += "Server error: The API server encountered an internal error.";
                        } else {
                            errorMessage += `Error ${jqXHR.status}: ${jqXHR.statusText}`;
                            
                            // Try to parse response text if available
                            if (jqXHR.responseText) {
                                try {
                                    const errorResponse = JSON.parse(jqXHR.responseText);
                                    if (errorResponse.error || errorResponse.message) {
                                        errorMessage += `<br>Details: ${errorResponse.error || errorResponse.message}`;
                                    }
                                } catch (e) {
                                    // If not JSON, include a snippet of the response
                                    if (jqXHR.responseText.length > 100) {
                                        errorMessage += `<br>Response: ${jqXHR.responseText.substring(0, 100)}...`;
                                    } else {
                                        errorMessage += `<br>Response: ${jqXHR.responseText}`;
                                    }
                                }
                            }
                        }
                        
                        // Add a debugging hint
                        errorMessage += "<br><br><small>Check your browser's console (F12) for more details.</small>";
                        
                        addMessage(errorMessage);
                    });
            });

            // Add modal functionality for image viewing
            function setupModalControls() {
                // Global variables for modal navigation
                let currentImages = [];
                let currentIndex = 0;
                
                // Function to update modal content
                function updateModalContent() {
                    if (currentImages.length === 0) return;
                    
                    const image = currentImages[currentIndex];
                    $('#modalImage').attr('src', image.src);
                    $('#modalImageCaption').text(`Seed: ${image.dataset.seed || 'Unknown'}`);
                    
                    // Enable/disable navigation buttons
                    $('#prevImageBtn').prop('disabled', currentIndex === 0);
                    $('#nextImageBtn').prop('disabled', currentIndex === currentImages.length - 1);
                }
                
                // Previous button click handler
                $('#prevImageBtn').click(function() {
                    if (currentIndex > 0) {
                        currentIndex--;
                        updateModalContent();
                    }
                });
                
                // Next button click handler
                $('#nextImageBtn').click(function() {
                    if (currentIndex < currentImages.length - 1) {
                        currentIndex++;
                        updateModalContent();
                    }
                });
                
                // Download button click handler
                $('#downloadImageBtn').click(function() {
                    if (currentImages.length === 0) return;
                    
                    const image = currentImages[currentIndex];
                    
                    // Create an anchor element
                    const downloadLink = document.createElement('a');
                    
                    // Set its href to the image src
                    downloadLink.href = image.src;
                    
                    // Set download attribute with a filename
                    const seed = image.dataset.seed || 'unknown';
                    downloadLink.download = `image-seed-${seed}.jpg`;
                    
                    // Append to the body, click it, and remove it
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
                });
                
                // Handle keyboard navigation
                $(document).keydown(function(e) {
                    if ($('#imageModal').hasClass('show')) {
                        if (e.which === 38 || e.which === 37) { // Up or Left arrow
                            $('#prevImageBtn').click();
                            e.preventDefault();
                        } else if (e.which === 40 || e.which === 39) { // Down or Right arrow
                            $('#nextImageBtn').click();
                            e.preventDefault();
                        } else if (e.which === 68 || e.which === 83) { // D or S key
                            $('#downloadImageBtn').click();
                            e.preventDefault();
                        }
                    }
                });
                
                // Delegate click handler for images
                $(document).on('click', '.image-grid-item img', function() {
                    // Find all images in this grid
                    const grid = $(this).closest('.image-grid-1x2, .image-grid-2x2');
                    currentImages = grid.find('img').toArray();
                    
                    // Set current index to the clicked image
                    currentIndex = currentImages.findIndex(img => img === this);
                    
                    // Update modal content
                    updateModalContent();
                });
            }
            
            // Call the setup function
            setupModalControls();

            // Function to show welcome screen
            function showWelcomeScreen() {
                $('#chat-body').html(`
                    <div class="welcome-screen" id="welcome-screen">
                        <div class="welcome-logo">
                            <i class="fas fa-rocket"></i>
                        </div>
                        <h2>Welcome to BKP3 AI</h2>
                        <p>Ask anything and get intelligent responses</p>
                        <div class="suggestion-grid">
                            <div class="suggestion-item" data-service="text">
                                <h4><i class="fas fa-comment-alt"></i> Text AI</h4>
                                <p>"Tell me about the latest advancements in AI"</p>
                                <span class="service-description">Ask questions, get information, or have a conversation</span>
                            </div>
                            <div class="suggestion-item" data-service="audio">
                                <h4><i class="fas fa-headphones"></i> Text-to-Audio</h4>
                                <p>"Convert this text to natural speech"</p>
                                <span class="service-description">Generate realistic audio from your text input</span>
                            </div>
                            <div class="suggestion-item" data-service="image">
                                <h4><i class="fas fa-image"></i> Image Generation</h4>
                                <p>"Create an image of a futuristic city"</p>
                                <span class="service-description">Generate custom images from text descriptions</span>
                            </div>
                        </div>
                    </div>
                `);
                
                // Setup suggestion click handlers
                $('.suggestion-item').click(function() {
                    const suggestion = $(this).find('p').text().replace(/"/g, '');
                    const serviceType = $(this).data('service');
                    
                    // Set the input value to the suggestion
                    $('#user-input').val(suggestion);
                    
                    // Switch to the appropriate service type
                    if (serviceType) {
                        $('#ai-service').val(serviceType).trigger('change');
                    }
                    
                    // Hide welcome screen
                    $('#welcome-screen').hide();
                    
                    // Focus on the input
                    $('#user-input').focus();
                });
            }
            
            // Process initial welcome message when page loads
            $(document).ready(function() {
                // Process any markdown in the AI message in the welcome screen
                const firstMessage = $('.first-message');
                if (firstMessage.length) {
                    // Get the HTML content
                    const htmlContent = firstMessage.html();
                    
                    // Convert markdown code blocks in the HTML content
                    firstMessage.html(TextFormatter.format(htmlContent));
                    
                    // Add copy buttons to code blocks
                    addCopyButtonsToCodeBlocks();
                }
            });
            
            // Add this function to handle showing the profile page
            function showProfilePage() {
                // Check if user is authenticated
                const user = firebase.auth().currentUser;
                if (!user) {
                    // Show auth modal if not logged in
                    const authModal = new bootstrap.Modal(document.getElementById('authModal'));
                    authModal.show();
                    return;
                }
                
                // Hide welcome screen if visible
                $('#welcome-screen').hide();
                
                // Clear chat interface
                $('#chat-body').html('');
                
                // Create and display profile page
                const profileHTML = `
                    <div class="profile-container">
                        <div class="profile-header">
                            <div class="profile-avatar">
                                <i class="fas fa-user-circle"></i>
                            </div>
                            <h2>${user.displayName || 'User'}</h2>
                            <p>${user.email}</p>
                        </div>
                        
                        <div class="profile-section">
                            <h3>Account Settings</h3>
                            <div class="profile-setting-item">
                                <div class="setting-label">
                                    <i class="fas fa-user"></i>
                                    <span>Display Name</span>
                                </div>
                                <div class="setting-control">
                                    <input type="text" class="form-control" id="display-name-input" value="${user.displayName || ''}">
                                    <button class="btn btn-sm btn-primary" id="update-name-btn">Update</button>
                                </div>
                            </div>
                            
                            <div class="profile-setting-item">
                                <div class="setting-label">
                                    <i class="fas fa-lock"></i>
                                    <span>Password</span>
                                </div>
                                <div class="setting-control">
                                    <button class="btn btn-outline-secondary" id="change-password-btn">Change Password</button>
                                </div>
                            </div>
                            
                            <div class="profile-setting-item">
                                <div class="setting-label">
                                    <i class="fas fa-envelope"></i>
                                    <span>Email Verification</span>
                                </div>
                                <div class="setting-control">
                                    ${user.emailVerified ? 
                                        '<span class="verification-status verified"><i class="fas fa-check-circle"></i> Verified</span>' : 
                                        '<span class="verification-status unverified"><i class="fas fa-exclamation-circle"></i> Not Verified</span>' +
                                        '<button class="btn btn-sm btn-primary ms-2" id="verify-email-btn">Send Verification</button>'
                                    }
                                </div>
                            </div>
                        </div>
                        
                        <div class="profile-section">
                            <h3>Preferences</h3>
                            <div class="profile-setting-item">
                                <div class="setting-label">
                                    <i class="fas fa-moon"></i>
                                    <span>Dark Mode</span>
                                </div>
                                <div class="setting-control">
                                    <div class="form-check form-switch">
                                        <input class="form-check-input" type="checkbox" id="dark-mode-toggle">
                                    </div>
                                </div>
                            </div>
                            
                            <div class="profile-setting-item">
                                <div class="setting-label">
                                    <i class="fas fa-bell"></i>
                                    <span>Notifications</span>
                                </div>
                                <div class="setting-control">
                                    <div class="form-check form-switch">
                                        <input class="form-check-input" type="checkbox" id="notifications-toggle" checked>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="profile-section">
                            <h3>Data & Privacy</h3>
                            <div class="profile-setting-item">
                                <div class="setting-label">
                                    <i class="fas fa-trash-alt"></i>
                                    <span>Delete Account</span>
                                </div>
                                <div class="setting-control">
                                    <button class="btn btn-danger" id="delete-account-btn">Delete My Account</button>
                                </div>
                            </div>
                            
                            <div class="profile-setting-item">
                                <div class="setting-label">
                                    <i class="fas fa-download"></i>
                                    <span>Download My Data</span>
                                </div>
                                <div class="setting-control">
                                    <button class="btn btn-outline-secondary" id="download-data-btn">Export Data</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                $('#chat-body').html(profileHTML);
                
                // Set page title
                $('#current-chat-title').text('Your Profile');
                
                // Add event handlers for profile page buttons
                setupProfilePageHandlers();
            }
            
            // Function to set up event handlers for profile page elements
            function setupProfilePageHandlers() {
                // Update display name
                $('#update-name-btn').click(function() {
                    const newName = $('#display-name-input').val().trim();
                    if (newName) {
                        updateUserDisplayName(newName);
                    }
                });
                
                // Change password button
                $('#change-password-btn').click(function() {
                    // Show password change form (could be implemented as a modal)
                    alert('Password change functionality would be implemented here');
                });
                
                // Email verification
                $('#verify-email-btn').click(function() {
                    sendVerificationEmail();
                });
                
                // Dark mode toggle (placeholder)
                $('#dark-mode-toggle').change(function() {
                    // Toggle dark mode implementation would go here
                    alert('Dark mode toggle would be implemented here');
                });
                
                // Delete account
                $('#delete-account-btn').click(function() {
                    if (confirm('Are you sure you want to delete your account? This cannot be undone.')) {
                        deleteUserAccount();
                    }
                });
                
                // Download data
                $('#download-data-btn').click(function() {
                    downloadUserData();
                });
            }
            
            // Helper functions for profile actions
            function updateUserDisplayName(newName) {
                const user = firebase.auth().currentUser;
                if (user) {
                    user.updateProfile({
                        displayName: newName
                    }).then(() => {
                        // Update display in UI
                        $('#user-display-name').text(newName);
                        alert('Display name updated successfully');
                    }).catch(error => {
                        console.error('Error updating display name:', error);
                        alert('Failed to update display name: ' + error.message);
                    });
                }
            }

            function sendVerificationEmail() {
                const user = firebase.auth().currentUser;
                if (user && !user.emailVerified) {
                    user.sendEmailVerification().then(() => {
                        alert('Verification email sent. Please check your inbox.');
                    }).catch(error => {
                        console.error('Error sending verification email:', error);
                        alert('Failed to send verification email: ' + error.message);
                    });
                }
            }

            function deleteUserAccount() {
                const user = firebase.auth().currentUser;
                if (user) {
                    user.delete().then(() => {
                        // Sign out and redirect to login
                        signOut();
                    }).catch(error => {
                        console.error('Error deleting account:', error);
                        if (error.code === 'auth/requires-recent-login') {
                            alert('For security reasons, please re-authenticate before deleting your account.');
                            // Re-authenticate user (could show login modal)
                            const authModal = new bootstrap.Modal(document.getElementById('authModal'));
                            authModal.show();
                        } else {
                            alert('Failed to delete account: ' + error.message);
                        }
                    });
                }
            }

            function downloadUserData() {
                // This would generate a JSON file with user data and chat history
                const user = firebase.auth().currentUser;
                if (user) {
                    // Create a data object with user info and chat sessions
                    const userData = {
                        userInfo: {
                            displayName: user.displayName,
                            email: user.email,
                            emailVerified: user.emailVerified,
                            uid: user.uid,
                            created: user.metadata.creationTime
                        },
                        chatSessions: chatSessions
                    };
                    
                    // Convert to JSON and create download link
                    const dataStr = JSON.stringify(userData, null, 2);
                    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
                    
                    const exportName = 'bkp3_user_data_' + new Date().toISOString().split('T')[0] + '.json';
                    
                    const linkElement = document.createElement('a');
                    linkElement.setAttribute('href', dataUri);
                    linkElement.setAttribute('download', exportName);
                    linkElement.click();
                }
            }
            
            console.log("BKP3 AI Assistant initialized!");

            // Handle Google sign up (use same logic as sign in but from the sign up form)
            $('#google-signup-btn').click(function(e) {
                e.preventDefault();
                
                // Clear error messages
                $('#auth-error').hide().text('');
                
                // Store original button content for restoring later
                const originalContent = $(this).html();
                
                // Show loading state
                $(this).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Connecting...').prop('disabled', true);
                
                const provider = new firebase.auth.GoogleAuthProvider();
                
                // Sign in with popup
                firebase.auth().signInWithPopup(provider)
                    .then((result) => {
                        // Close the modal
                        const authModal = bootstrap.Modal.getInstance(document.getElementById('authModal'));
                        if (authModal) {
                            authModal.hide();
                        }
                        
                        // Reset button state
                        $(this).html(originalContent).prop('disabled', false);
                    })
                    .catch((error) => {
                        // Reset button state
                        $(this).html(originalContent).prop('disabled', false);
                        
                        // Handle errors
                        const errorMessage = getAuthErrorMessage(error.code) || 'Error signing up with Google';
                        $('#auth-error').text(errorMessage).show();
                        console.error("Google sign-up error:", error);
                    });
            });

            // Load user's chat history from Firestore
            function loadUserChatHistory() {
                if (!currentUser) {
                    console.log("No current user, can't load chat history");
                    return;
                }
                
                console.log("Loading chat history for user:", currentUser.uid);
                
                // Clear existing chats from UI
                chatSessions = [];
                $('#chat-history-items').empty();
                
                // Initially hide the no history message
                toggleNoHistoryMessage(false);
                
                // Show loading indicator
                $('#chat-history-items').html('<div class="text-center p-3"><div class="spinner-border spinner-border-sm text-secondary" role="status"></div><p class="mt-2 text-secondary">Loading history...</p></div>');
                
                // Query Firestore for user's chat history
                db.collection('users').doc(currentUser.uid).collection('chats')
                    .orderBy('lastUpdated', 'desc')
                    .limit(MAX_SAVED_CHATS)
                    .get()
                    .then((querySnapshot) => {
                        // Clear loading indicator
                        $('#chat-history-items').empty();
                        
                        console.log("Firestore query returned:", querySnapshot.size, "chats");
                        
                        if (querySnapshot.empty) {
                            console.log("No chat history found, showing no-history message");
                            // Show no history message
                            toggleNoHistoryMessage(true);
                            // Don't override welcome screen
                            return;
                        }
                        
                        // Hide no history message
                        toggleNoHistoryMessage(false);
                        
                        // Process each chat session
                        querySnapshot.forEach((doc) => {
                            const chatData = doc.data();
                            console.log("Processing chat:", doc.id, chatData.title);
                            chatSessions.push({
                                id: doc.id,
                                title: chatData.title || 'Untitled Chat',
                                messages: chatData.messages || [],
                                date: chatData.lastUpdated?.toDate() || new Date()
                            });
                        });
                        
                        console.log("Total chat sessions loaded:", chatSessions.length);
                        
                        // Update the sidebar with chat history
                        updateChatSidebar();
                        
                        // Don't automatically load a chat - keep the welcome screen
                        // This will allow browsing history while keeping the welcome screen visible
                    })
                    .catch((error) => {
                        console.error("Error loading chat history:", error);
                        $('#chat-history-items').html('<div class="text-center p-3 text-danger"><i class="fas fa-exclamation-circle"></i><p class="mt-2">Failed to load chat history</p></div>');
                        toggleNoHistoryMessage(false);  // Hide the no history message when there's an error
                    });
            }
        });