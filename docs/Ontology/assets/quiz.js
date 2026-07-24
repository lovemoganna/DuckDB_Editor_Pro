const quiz = document.querySelector("[data-quiz]");

if (quiz) {
  const questions = [...quiz.querySelectorAll("[data-answer]")];
  const progress = quiz.querySelector("[data-progress]");
  const reset = quiz.querySelector("[data-reset]");

  const updateProgress = () => {
    const solved = questions.filter((question) =>
      question.classList.contains("is-solved"),
    ).length;

    progress.textContent =
      solved === questions.length
        ? `${solved}/${questions.length} 已完成。你已经通过本课练习。`
        : `${solved}/${questions.length} 已完成。`;
  };

  questions.forEach((question) => {
    const correctAnswer = question.dataset.answer;
    const explanation = question.dataset.explanation;
    const hint =
      question.dataset.hint ?? "再看一次材料和本课判断规则，然后重试。";
    const feedback = question.querySelector("[data-feedback]");
    const choices = [...question.querySelectorAll("[data-choice]")];

    choices.forEach((choice) => {
      choice.addEventListener("click", () => {
        if (question.classList.contains("is-solved")) return;

        choices.forEach((item) => item.classList.remove("is-wrong"));

        if (choice.dataset.choice === correctAnswer) {
          question.classList.add("is-solved");
          choice.classList.add("is-correct");
          feedback.textContent = `正确。${explanation}`;
          choices.forEach((item) => {
            item.disabled = true;
          });
        } else {
          choice.classList.add("is-wrong");
          feedback.textContent = hint;
        }

        updateProgress();
      });
    });
  });

  reset.addEventListener("click", () => {
    questions.forEach((question) => {
      question.classList.remove("is-solved");
      question.querySelector("[data-feedback]").textContent = "";
      question.querySelectorAll("[data-choice]").forEach((choice) => {
        choice.disabled = false;
        choice.classList.remove("is-correct", "is-wrong");
      });
    });
    updateProgress();
  });

  updateProgress();
}

document.querySelectorAll("[data-reveal]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = document.getElementById(button.dataset.reveal);
    const visible = target.classList.toggle("is-visible");
    button.textContent = visible ? "收起参考" : "查看参考";
  });
});
