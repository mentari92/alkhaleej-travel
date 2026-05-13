import os

TARGET = os.path.join(os.path.dirname(__file__), "..", "src", "components", "admin", "SettingsForm.tsx")

CODE = open(os.path.join(os.path.dirname(__file__), "settings_form_content.txt"), encoding="utf-8").read()

with open(TARGET, "w", encoding="utf-8") as f:
    f.write(CODE)

print(f"Written {len(CODE)} chars to {TARGET}")
