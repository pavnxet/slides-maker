from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1920, "height": 1080})

        print("Navigating to http://localhost:8080")
        page.goto("http://localhost:8080")

        # 1. Check PWA Manifest
        manifest_link = page.locator('link[rel="manifest"]')
        if manifest_link.count() > 0:
            print("PASS: PWA Manifest link found.")
        else:
            print("FAIL: PWA Manifest link not found.")

        # 2. Test Live Preview
        input_text = """1. Preview Test
A. Preview Option A
B. Preview Option B
C. Preview Option C
D. Preview Option D
"""
        print("Filling input for preview...")
        page.fill("#questionInput", input_text)
        time.sleep(2) # Wait for debounce

        # Check if preview container has content
        preview_content = page.locator("#previewContainer > div")
        if preview_content.count() > 0:
             print("PASS: Live Preview updated.")
        else:
             print("FAIL: Live Preview empty.")

        page.screenshot(path="verification_preview.png")
        print("Screenshot saved to verification_preview.png")

        # 3. Test Theme Toggle
        print("Switching to Dark Mode...")
        page.select_option("#themeSelect", "dark")
        time.sleep(1)
        page.screenshot(path="verification_theme_dark.png")
        print("Screenshot saved to verification_theme_dark.png")

        print("Switching to Print Mode...")
        page.select_option("#themeSelect", "print")
        time.sleep(1)
        page.screenshot(path="verification_theme_print.png")
        print("Screenshot saved to verification_theme_print.png")

        browser.close()

if __name__ == "__main__":
    run()
