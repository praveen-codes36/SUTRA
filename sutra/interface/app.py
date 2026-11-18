"""
SUTRA — Streamlit Demonstration Interface.
Owned by Person 3 (Product Interface, Security & Demonstration).
"""

import os
import sys

# Ensure sutra is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

try:
    import streamlit as st
except ImportError:
    st = None

def main():
    if not st:
        print("Streamlit is not installed. Please run: pip install streamlit")
        return

    st.set_page_config(page_title="SUTRA — Institutional Email Intelligence", page_icon="🧠", layout="wide")
    st.title("🧠 SUTRA — Institutional Email Intelligence Platform")
    st.markdown("*Transforming fragmented conversations into connected, searchable, and actionable institutional knowledge.*")

    st.sidebar.header("Navigation")
    view = st.sidebar.radio("Select View", ["Search & RAG Chat", "Thread Explorer", "Pending Actions Dashboard", "Evaluation & Benchmark"])

    if view == "Search & RAG Chat":
        st.subheader("🔎 Natural-Language Question Answering")
        query = st.text_input("Ask a question about institutional decisions, approvals, or events:", value="What was the final decision on the CNC machine procurement?")
        if st.button("Query SUTRA"):
            st.info(f"Querying SUTRA knowledge base for: {query}")
            # Role 2 engine connection goes here

    elif view == "Thread Explorer":
        st.subheader("🧵 Thread & Conversation Explorer")
        st.info("Explore all 10 institutional conversation threads, message flows, and attachments.")

    elif view == "Pending Actions Dashboard":
        st.subheader("📋 Pending Actions & Responsibilities")
        st.info("Track pending administrative tasks, owners, and deadlines.")

    elif view == "Evaluation & Benchmark":
        st.subheader("📊 Hackathon Evaluation Benchmark")
        st.info("Run official benchmark scoring against the 15 queries and 9 evaluation cases.")

if __name__ == "__main__":
    main()

