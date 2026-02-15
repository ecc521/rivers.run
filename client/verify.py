from playwright.sync_api import sync_playwright
import time

def verify_app():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            print("Navigating to http://localhost:8081...")
            # Try a few times
            for i in range(5):
                try:
                    page.goto("http://localhost:8081", timeout=10000)
                    break
                except Exception as e:
                    print(f"Attempt {i+1} failed: {e}")
                    time.sleep(5)

            print("Waiting for content...")
            # Wait for search input
            page.wait_for_selector('input[placeholder="Search rivers..."]', timeout=60000)

            # Wait a bit for list to render
            time.sleep(5)

            print("Taking screenshot...")
            page.screenshot(path="verification.png")
            print("Screenshot saved to verification.png")

        except Exception as e:
            print(f"Error: {e}")
            try:
                page.screenshot(path="verification_error.png")
            except:
                pass
        finally:
            browser.close()

if __name__ == "__main__":
    verify_app()
