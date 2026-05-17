---
id: troubleshooting
title: Troubleshooting Guide
topic: troubleshooting
scope: starter
excerpt: Troubleshoot common issues with live sessions, responses, analytics, and performance.
---

# Troubleshooting Guide

## Session Connection and Stability Issues

### "Connection Lost" Error

This means the WebSocket connection to the session dropped.

#### Quick Fixes (Try in Order)

1. **Refresh the page** (F5 or Cmd+R)
   - Reconnects you to the session
   - Your responses are preserved

2. **Check your internet**
   - Is WiFi/mobile signal strong?
   - Try switching networks if possible
   - Restart router if WiFi is weak

3. **Close other tabs/apps**
   - Free up bandwidth
   - Qesto needs 1-2 Mbps to function
   - Video streaming can interfere

4. **Check browser console for errors** (F12)
   - Look for network errors
   - Screenshot and share with support

5. **Try a different browser**
   - Chrome, Firefox, Safari, Edge all supported
   - Rules out browser-specific issues

6. **Disable VPN/Proxy**
   - Sometimes blocks WebSocket connections
   - Try without VPN

#### If It Persists

Email support@qesto.cc with:
- Session ID
- Error message screenshot
- Your internet speed (speedtest.net)
- Browser/OS
- When it started

### Responses Not Submitting

You clicked "Submit" but don't see confirmation.

#### Check

1. **Is the connection stable?** Check the connection indicator
2. **Is the question still open?** Closed questions can't accept responses
3. **Refresh and try again** (may be a temporary glitch)
4. **Try mobile/different device** (rules out device-specific issue)

### Session Keeps Disconnecting

You reconnect, then drop again.

#### Causes

- **Unstable internet**: Most common
- **Network switching**: Jumping between WiFi and mobile
- **VPN/proxy issues**: Try disabling
- **Too many people**: Rare, but possible with 500+ participants

#### Solutions

1. Stay on one network (don't switch WiFi/mobile)
2. Move closer to WiFi router
3. Use mobile hotspot as backup
4. Disable VPN
5. Close bandwidth-heavy apps

### Responses Loading Slowly

You submitted a response, but it's taking time to show.

#### Normal?

- With 50+ participants, slight delays (1-2s) are expected
- With 500+ participants, expect 3-5s delays
- Your response is queued and will show

#### Speed It Up

1. Refresh page (forces re-sync)
2. Check your internet speed
3. Close other tabs

### Session Ended Unexpectedly

The host closed the session while you were in it.

#### What Happens

- You'll see "Session Ended" message
- Your responses are saved
- Results will be available shortly
- You can refresh to see final results

### Still Having Issues?

Email support@qesto.cc with:
- **Session ID**: Bottom of the session page
- **Time it happened**: (include timezone)
- **Device/Browser**: (e.g., iPhone Safari)
- **Internet connection**: (WiFi/mobile)
- **Screenshot**: Of the error

We'll investigate and get back to you within 2 hours.

---

## Responses and Results Not Showing

### My Response Isn't Showing

You voted/answered, but don't see yourself in the results.

#### Check

1. **Did you actually submit?**
   - Look for confirmation (button change, checkmark)
   - Try submitting again to be sure

2. **Is the question still open?**
   - Qesto closes questions when the host moves to the next question
   - Late responses aren't accepted
   - Wait for the next question

3. **Are you logged in?**
   - Anonymous responses don't show names
   - Check your session settings

4. **Browser issue?**
   - Try incognito/private mode
   - Clear cache (Ctrl+Shift+Delete)
   - Refresh the page

5. **Reconnect**
   - Refresh (F5) to sync with server
   - Your response should appear

### Other Participants' Responses Missing

Some people voted, but their votes aren't showing.

#### Check

1. **Are they still connected?**
   - Check participant count
   - Ask them if they see responses from others

2. **Did they submit?**
   - Remind them to click "Submit"
   - Sometimes easy to miss

3. **Network lag**
   - With 100+ people, 2-3 second delay is normal
   - Wait a few seconds for responses to sync

4. **Host refresh**
   - Host should refresh page if seeing outdated numbers
   - Participants will still be connected

### Results Not Showing After Session Closes

Session is closed, but results page is blank.

#### Try

1. **Refresh page** (F5)
   - Results may not have loaded initially

2. **Wait 30 seconds**
   - With large sessions, processing takes time
   - Results will appear once calculated

3. **Try different browser**
   - Rules out browser cache issue

4. **Check if session actually closed**
   - Go to Sessions → select the session
   - Confirm it shows "Closed" status

### Results Page Crashed

Results page won't load or keeps refreshing.

#### Try

1. **Force refresh** (Ctrl+Shift+R on Windows, Cmd+Shift+R on Mac)
   - Clears all cache

2. **Wait 5 minutes**
   - Large sessions need time to process
   - Come back and try again

3. **Try CSV export**
   - If results are available, export them
   - View in Excel/Sheets instead

4. **Different browser**
   - Try Chrome if you're in Firefox
   - Rules out browser-specific bug

### Export/Download Not Working

You clicked CSV export but nothing happened.

#### Check

1. **Is it a free session?**
   - CSV export only available on Starter+ plans
   - Upgrade to download

2. **Browser popup blocker**
   - Allow popups for qesto.cc
   - Try again

3. **Check Downloads folder**
   - File may have downloaded silently

4. **Try different browser**
   - Safari sometimes blocks downloads
   - Try Chrome instead

### Still Can't See Results?

Email support@qesto.cc with:
- Session ID
- Question type (Poll, Ranking, etc)
- Number of participants
- Screenshot of the issue

We can manually investigate!

---

## AI Insights and Analytics Issues

**Note:** AI Insights requires Starter plan or higher.

### "Generating Insights..." Takes Too Long

The insights spinner has been spinning for 2+ minutes.

#### What's Normal?

- 50-100 responses: 10-30 seconds
- 100-500 responses: 30-60 seconds
- 500+ responses: 1-3 minutes

#### If Waiting Longer

1. **Wait a bit more**
   - Sometimes Qesto is processing
   - Don't refresh yet

2. **Refresh the page** (F5)
   - Resets the insights generation
   - Usually solves the issue

3. **Check your plan**
   - AI Insights requires Starter+
   - Free plan doesn't have this feature

4. **If still stuck**
   - Try again in 5 minutes
   - Qesto may be busy

### Insights Are Blank or Wrong

AI generated insights, but they seem irrelevant or generic.

#### Why This Happens

- **Too few open responses**: Need 10+ open-ended responses for good themes
- **Similar answers**: If everyone gives the same answer, only one theme shows
- **Generic responses**: "Good" or "Yes" responses are harder to cluster
- **Mixed languages**: English + other languages confuses AI

#### Improve Insights

1. **Reword your question**
   - More specific questions → better themes
   - Instead of "Feedback?", ask "What was your biggest challenge?"

2. **Make it open-ended**
   - Open questions generate richer insights than polls

3. **Review the responses manually**
   - Sometimes manual reading beats AI
   - Download CSV and group yourself

4. **Try again with fresh data**
   - Run a new session with refined questions

### "Insights Not Available" Error

You see this message instead of insights.

#### Check

1. **Is the session closed?**
   - Insights only work on closed sessions
   - Close your session first

2. **Do you have an open question?**
   - Insights require open-ended responses
   - Polls alone won't generate themes

3. **Are you on Starter+?**
   - Free plan doesn't have insights
   - Upgrade to access

4. **Did the insights fail?**
   - Sometimes AI analysis fails
   - Refresh and try again

### API/Webhook Issues

**Note:** API access requires Team plan.

#### Webhook Not Firing

1. **Check your webhook URL**
   - Must be HTTPS
   - Must return 200-299 status code

2. **Check event type**
   - "session_closed" only fires when session closes
   - Not instant—takes 30-60 seconds

3. **Check logs**
   - Dashboard shows recent webhook attempts
   - Look for error messages

4. **Test webhook**
   - Use https://webhook.site to test
   - Verify your endpoint receives data

#### API Request Failing

1. **Check authentication**
   - Include Bearer token in header
   - Token must be active

2. **Check request body**
   - Ensure JSON is valid
   - Use correct field names

3. **Check rate limits**
   - Team plan: 1000 requests/hour
   - If exceeded, retry with exponential backoff

4. **Read error message**
   - API returns specific error codes
   - See API docs for meanings

### Questions About Analytics?

Email support@qesto.cc and describe:
- Session ID
- Number of responses
- Question type
- What insights you expected

We can help debug!

---

## Performance, Slow Loading, and Browser Issues

### Page Loads Slowly

Qesto takes 5+ seconds to load.

#### Check Bandwidth

1. **Test internet speed**: speedtest.net
   - Need at least 2 Mbps
   - Mobile 3G/LTE may be slow
   - 4G/WiFi is faster

2. **Check WiFi signal**
   - Move closer to router
   - Check if router is overloaded
   - Switch to 5GHz band if available

3. **Close other apps**
   - Video streaming uses lots of bandwidth
   - Pause background downloads
   - Close video calls temporarily

#### Clear Cache

1. **Chrome**: Ctrl+Shift+Delete
2. **Firefox**: Ctrl+Shift+Delete
3. **Safari**: Cmd+Option+E
4. **Edge**: Ctrl+Shift+Delete

Select "All time" and clear.

### Questions Won't Load

You're in a session, but questions aren't showing.

#### Try

1. **Refresh page** (F5)
   - Sometimes helps with loading issues

2. **Hard refresh** (Ctrl+F5)
   - Clears cache and reloads everything

3. **Try different browser**
   - Chrome, Firefox, Safari, Edge all work
   - Narrows down if it's browser-specific

4. **Check connection**
   - Look for connection indicator
   - If red/yellow, reconnect

### UI Buttons Not Responsive

You click buttons but nothing happens.

#### Try

1. **Wait a moment**
   - Sometimes JS takes time to load
   - Click once and wait 2 seconds

2. **Refresh page**
   - Full refresh fixes most UI issues

3. **Check console errors**
   - F12 → Console tab
   - Look for red error messages
   - Screenshot and email support@qesto.cc

4. **Try without extensions**
   - Browser extensions can interfere
   - Try Incognito mode

### Animations/Video Very Laggy

WordCloud or animations are stuttering.

#### Causes

- GPU acceleration off
- Old browser version
- Too many participants
- Weak device (old phone/tablet)

#### Solutions

1. **Update your browser**
   - Chrome, Firefox, Safari need regular updates
   - Outdated browsers are slower

2. **Enable hardware acceleration**
   - Chrome: Settings → System → Toggle "Use Hardware Acceleration"
   - Firefox: about:config → search "layers.acceleration.force-enabled"

3. **Close other apps**
   - Frees up CPU/GPU

4. **Use desktop instead of mobile**
   - Phones have weaker graphics

### "Out of Memory" Error

Browser crashes or shows memory error.

#### This Happens When

- Session has been open 2+ hours
- Very large sessions (1000+ participants)
- Browser has many old tabs open

#### Fix

1. **Close other tabs** to free up memory
2. **Refresh Qesto page** to reset
3. **Restart browser** if really bad
4. **Use different device** if it persists

### Browser Not Supported

You see a warning about your browser.

#### Supported Browsers

- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest version)
- Edge (latest version)

#### If Unsupported

1. **Update your browser**
   - Go to browser menu → Help → Check for updates

2. **Try a different browser**
   - Download Chrome or Firefox
   - Same Qesto account works everywhere

3. **Older phone/tablet?**
   - Try upgrading your device OS
   - Or use a newer device

### Still Having Issues?

Email support@qesto.cc with:
- Browser/Version (e.g., Chrome 120)
- Operating system (Windows/Mac/iOS/Android)
- Approximate internet speed
- Screenshot of issue
- When it started

We'll help troubleshoot!
