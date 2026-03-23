import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";
import { chatApi } from "@/services/api";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
  suggestions?: string[];
}

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  text: "Hey! I'm Ace, the RGDGC assistant. Ask me about standings, events, rules, or anything disc golf!",
  sender: "bot",
  timestamp: new Date(),
};

const QUICK_ACTIONS = [
  { label: "Standings", message: "Show me the current standings" },
  { label: "Next Event", message: "When is the next event?" },
  { label: "Rules", message: "What are the league rules?" },
];

async function sendToAce(message: string): Promise<{ text: string; suggestions: string[] }> {
  try {
    const data = await chatApi.send(message);
    return {
      text: data.response,
      suggestions: data.suggestions ?? [],
    };
  } catch (err) {
    // Offline or auth error — provide a helpful message
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("401") || msg.includes("Unauthorized")) {
      return { text: "Please log in to chat with Ace.", suggestions: [] };
    }
    return {
      text: "I'm having trouble connecting right now. Check your internet and try again.",
      suggestions: ["Show standings", "Next event"],
    };
  }
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const handleSend = useCallback(
    async (text?: string) => {
      const messageText = (text ?? inputText).trim();
      if (!messageText) return;

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        text: messageText,
        sender: "user",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputText("");
      scrollToBottom();

      setIsTyping(true);
      scrollToBottom();

      try {
        const { text, suggestions } = await sendToAce(messageText);
        const botMessage: Message = {
          id: `bot-${Date.now()}`,
          text,
          sender: "bot",
          timestamp: new Date(),
          suggestions: suggestions.length > 0 ? suggestions : undefined,
        };
        setMessages((prev) => [...prev, botMessage]);
      } catch {
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          text: "Oops, something went wrong. Please try again.",
          sender: "bot",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsTyping(false);
        scrollToBottom();
      }
    },
    [inputText, scrollToBottom]
  );

  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isUser = item.sender === "user";
    return (
      <View
        style={[
          styles.messageBubbleWrapper,
          isUser ? styles.userBubbleWrapper : styles.botBubbleWrapper,
        ]}
      >
        {!isUser && (
          <View style={styles.botAvatar}>
            <Ionicons name="paw" size={16} color={colors.text.inverse} />
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.botBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isUser ? styles.userMessageText : styles.botMessageText,
            ]}
          >
            {item.text}
          </Text>
          <Text
            style={[
              styles.timestamp,
              isUser ? styles.userTimestamp : styles.botTimestamp,
            ]}
          >
            {item.timestamp.toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </Text>
        </View>
      </View>
    );
  }, []);

  const renderTypingIndicator = () => {
    if (!isTyping) return null;
    return (
      <View style={[styles.messageBubbleWrapper, styles.botBubbleWrapper]}>
        <View style={styles.botAvatar}>
          <Ionicons name="paw" size={16} color={colors.text.inverse} />
        </View>
        <View style={[styles.messageBubble, styles.botBubble, styles.typingBubble]}>
          <ActivityIndicator size="small" color={colors.text.secondary} />
          <Text style={styles.typingText}>Ace is typing...</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="paw" size={20} color={colors.text.inverse} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Club Chat</Text>
            <Text style={styles.headerSubtitle}>Powered by @clawd bot</Text>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
          ListFooterComponent={renderTypingIndicator}
        />

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.quickActionButton}
              onPress={() => handleSend(action.message)}
              activeOpacity={0.7}
            >
              <Text style={styles.quickActionText}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask Ace anything..."
            placeholderTextColor={colors.text.disabled}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => handleSend()}
            blurOnSubmit
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              !inputText.trim() && styles.sendButtonDisabled,
            ]}
            onPress={() => handleSend()}
            disabled={!inputText.trim() || isTyping}
            activeOpacity={0.7}
          >
            <Ionicons
              name="send"
              size={20}
              color={
                inputText.trim() && !isTyping
                  ? colors.text.inverse
                  : colors.text.disabled
              }
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
    gap: spacing.sm,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
  },
  messageList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexGrow: 1,
  },
  messageBubbleWrapper: {
    flexDirection: "row",
    marginBottom: spacing.sm,
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  userBubbleWrapper: {
    justifyContent: "flex-end",
  },
  botBubbleWrapper: {
    justifyContent: "flex-start",
  },
  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  messageBubble: {
    maxWidth: "75%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.lg,
  },
  userBubble: {
    backgroundColor: colors.secondary,
    borderBottomRightRadius: borderRadius.sm,
  },
  botBubble: {
    backgroundColor: colors.gray[100],
    borderBottomLeftRadius: borderRadius.sm,
  },
  messageText: {
    fontSize: fontSize.base,
    lineHeight: 22,
  },
  userMessageText: {
    color: colors.text.inverse,
  },
  botMessageText: {
    color: colors.text.primary,
  },
  timestamp: {
    fontSize: fontSize.xs - 1,
    marginTop: spacing.xs,
  },
  userTimestamp: {
    color: "rgba(255,255,255,0.7)",
    textAlign: "right",
  },
  botTimestamp: {
    color: colors.text.disabled,
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  typingText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontStyle: "italic",
  },
  quickActions: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  quickActionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.bg.primary,
  },
  quickActionText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.primary,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    backgroundColor: colors.bg.primary,
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.base,
    color: colors.text.primary,
    backgroundColor: colors.gray[50],
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: colors.gray[200],
  },
});
