import React, { useState, useRef, useEffect } from "react";
import {
  TextInput,
  View,
  Text,
  Button,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  TouchableOpacity,
} from "react-native";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface Task {
  taskName: string;
  dueDate: string | null;
  priority: "low" | "normal" | "high";
  category: "work" | "personal" | "health" | "other";
}

interface AIResponse {
  intent: "task" | "incomplete_task" | "chat";
  response: string;
  task?: Task;
}

interface Message {
  text: string;
  isUser: boolean;
}

export default function App() {
  const [userMessage, setUserMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const apiKey = process.env.EXPO_PUBLIC_API_KEY || ""; // Replace with your actual API key

  useEffect(() => {
    // Scroll to the bottom whenever messages change
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const googleGemini = async (userMessage: string, chatHistory: Message[]) => {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Format the chat history for the prompt
    const formattedHistory = chatHistory
      .map((msg) => `${msg.isUser ? "User:" : "AI:"} ${msg.text}`)
      .join("\n");

    const prompt = `
You are a helpful assistant that can understand task requests and general conversations.
Maintain the context of the conversation. Use the previous chat history provided to respond to the user.
Analyze the following message and determine whether it's a task request or a general conversation.

Here's the previous conversation history:
${formattedHistory}
- If it's a task, return structured JSON with "intent": "task" and provide task details.
- If the task is missing essential details (task name, due date, priority, category), return "intent": "incomplete_task" and ask for the missing details. Remember the previous information they gave you in the conversation.
- If it's not a task, return "intent": "chat" and generate a normal conversation response. Keep it succinct and relevant.
- Always adhere to Response format only. Do not add any extra fields or characters. Ensure the output is valid JSON. If a field in the task is missing, set to null or appropriate default.
- Respond in a concise and natural way as if having a normal conversation, while always keeping the structured JSON output format in mind.
- feel free to deside the task details if the user didn't provide them other than the dueDate and the taskName.if the user ask you to create a task without providing the taskName add the best taskName you can think of.

Message: "${userMessage}"
Today's date: "${new Date().toISOString()}"

Response format:
\`\`\`json
{
  "intent": "task" | "incomplete_task" | "chat",
  "response": "AI response for normal chat or missing task details.Always provide a response to the user.Do not keep empty responses.",
  "task": {
    "taskName": "string",
    "dueDate": "ISO 8601 datetime or null if missing",
    "priority": "low" | "normal" | "high",
    "category": "work" | "personal" | "health" | "any other category you decide"
  }
}
\`\`\`
`;

    try {
      const result = await model.generateContent(prompt);
      const aiResponse: string = result.response.text();
      return aiResponse;
    } catch (error) {
      console.error("Gemini API Error:", error);
      return JSON.stringify({
        intent: "chat",
        response: "Sorry, I encountered an error. Please try again.",
      }); // Return a default response on API error
    }
  };

  const handleUserMessage = async () => {
    if (!userMessage.trim()) return;

    const newMessage: Message = { text: userMessage, isUser: true };
    setMessages((prevMessages) => [...prevMessages, newMessage]); // Add user message to state

    setLoading(true);
    try {
      const aiResponseString = await googleGemini(userMessage, messages);
      const cleanedAIResponseString = aiResponseString
        .replace(/```json/g, "")
        .replace(/```/g, "");

      const aiResponse: AIResponse = JSON.parse(cleanedAIResponseString);

      const aiChatMessage: Message = {
        text: aiResponse.response,
        isUser: false,
      };
      setMessages((prevMessages) => [...prevMessages, aiChatMessage]); // Add AI response to state

      if (aiResponse.intent === "task" && aiResponse.task) {
        setTasks((prevTasks) => [...prevTasks, aiResponse.task!]);
      }
    } catch (error) {
      console.error("Error processing message:", error);
      const errorChatMessage: Message = {
        text: "Sorry, I couldn't process that.",
        isUser: false,
      };
      setMessages((prevMessages) => [...prevMessages, errorChatMessage]);
    }

    setLoading(false);
    setUserMessage("");
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.messageContainer}
        ref={scrollViewRef}
        onContentSizeChange={() =>
          scrollViewRef.current?.scrollToEnd({ animated: true })
        }
      >
        {messages.map((message, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.messageBubble,
              message.isUser ? styles.userMessage : styles.aiMessage,
            ]}
          >
            <Text style={styles.messageText}>{message.text}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={80}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={userMessage}
            onChangeText={setUserMessage}
            placeholder="Type your message..."
            editable={!loading}
          />
          <Button
            title={loading ? "Sending..." : "Send"}
            onPress={handleUserMessage}
            disabled={loading}
          />
        </View>
      </KeyboardAvoidingView>

      <View style={styles.taskListContainer}>
        <Text style={styles.taskListTitle}>Tasks:</Text>
        {tasks.length === 0 ? (
          <Text>No tasks yet.</Text>
        ) : (
          tasks.map((task, index) => (
            <View key={index} style={styles.taskItem}>
              <Text>{task.taskName}</Text>
              <Text>Due: {task.dueDate || "N/A"}</Text>
              <Text>Priority: {task.priority}</Text>
              <Text>Category: {task.category}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    marginTop: 25,
  },
  messageContainer: {
    flex: 1,
    marginBottom: 10,
  },
  messageBubble: {
    padding: 10,
    marginBottom: 5,
    maxWidth: "75%",
  },
  userMessage: {
    backgroundColor: "#DCF8C6",
    alignSelf: "flex-end",
    borderTopLeftRadius: 15,
    borderBottomLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  aiMessage: {
    backgroundColor: "#FFFFFF",
    alignSelf: "flex-start",
    borderTopLeftRadius: 15,
    borderBottomRightRadius: 15,
    borderTopRightRadius: 15,
  },
  messageText: {
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    padding: 10,
    marginRight: 10,
    backgroundColor: "#fff",
  },
  taskListContainer: {
    // marginTop: 20,
    marginBottom: 50,
  },
  taskListTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  taskItem: {
    backgroundColor: "#fff",
    padding: 10,
    marginBottom: 5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#eee",
  },
});
